// Challenges (Medium and Hard): what a player can challenge, and what happens next.
//
// At the start of a turn, before moving, a player may challenge the opponent's
// last turn by naming a rule it broke. If the move did break that rule the
// challenge is *correct*; if not, it is *incorrect* and costs the challenger a
// strike (three strikes loses the game).
//
// Some outcomes need a person to choose something. Those leave a note in
// `state.pending` saying who has to choose and what, and the next move is the
// choice. Every function here takes a state and returns a new one, like the
// rest of the game logic: { ok: true, state } or { ok: false, message }.

import { getShapeCells } from "./pieces.js";
import { orientations, shapeKey } from "./transforms.js";
import { analyzePlacement } from "./analyze.js";
import { copyState, otherPlayer } from "./state.js";
import { restoreSnapshot } from "./history.js";
import { PIECES_PER_PLAYER } from "./constants.js";
import { challengesEnabled, isOnBoard, isStar, occupiedSquares, squareKey } from "./rules.js";
import { hasLegalPlacement, getPossibleMoves } from "./moves.js";
import { checkStuckPlayer } from "./turn.js";

export const STRIKES_TO_LOSE = 3;

// Every rule that can be challenged, in the order the challenge list shows them.
// "kind" decides what happens after the challenge (see the outcome table in
// docs/decisions.md): "placement", "other", or "three-in-a-row".
export const CHALLENGE_CATEGORIES = [
  { id: "placement-star", kind: "placement", label: "A piece was placed on a star" },
  { id: "placement-contact", kind: "placement", label: "A piece was placed touching the opponent's piece along an edge" },
  { id: "slide-blocked", kind: "other", label: "A piece slid over a chip, a piece, or a star" },
  { id: "star-landing", kind: "other", label: "A piece ended its move on a star" },
  { id: "chip-blocked", kind: "other", label: "A chip passed over a piece, a chip, or a star, or landed on a star" },
  { id: "chip-repeat", kind: "other", label: "A chip was moved two turns in a row" },
  { id: "piece-repeat", kind: "three-in-a-row", label: "The same piece was moved three turns in a row" },
];

const fail = (message) => ({ ok: false, message });

// May the player to move challenge the opponent's last turn right now?
export function canChallenge(state) {
  return challengesEnabled(state)
    && (state.phase === "placement" || state.phase === "movement")
    && state.pending === null
    && state.lastTurn !== null
    && state.lastTurn.player !== state.currentPlayer;
}

// The player who has to act next: whoever the pending decision is waiting on,
// or else the player to move.
export function actingPlayer(state) {
  return state.pending ? state.pending.chooser : state.currentPlayer;
}

// ---------------------------------------------------------------------------
// Making a challenge
// ---------------------------------------------------------------------------

// The player to move names a rule that the opponent's last turn broke.
export function challenge(state, category) {
  if (!canChallenge(state)) return fail("There is nothing to challenge right now.");

  const info = CHALLENGE_CATEGORIES.find((candidate) => candidate.id === category);
  if (!info) return fail("That isn't a rule that can be challenged.");

  const challenger = state.currentPlayer;
  const offender = state.lastTurn.player;
  const correct = state.lastTurn.violations.includes(category);
  const entry = { type: "challenge", player: challenger, category, correct };

  if (correct && info.kind === "three-in-a-row") {
    const next = copyState(state);
    next.moveLog.push(entry);
    next.phase = "gameover";
    next.winner = challenger;
    next.winReason = "three-in-a-row";
    return { ok: true, state: next };
  }

  if (correct) {
    // The board goes back to how it was before the rule-breaking move.
    const next = restoreBeforeLastMove(state);
    next.moveLog.push(entry);
    next.lastTurn = null;

    if (info.kind === "placement") {
      // The challenger places one of the offender's shapes for them, legally.
      next.currentPlayer = challenger;
      if (hasLegalPlacement(next, offender)) {
        next.pending = { kind: "place-for", chooser: challenger, challenger, offender };
      } else {
        next.phase = "gameover";
        next.winner = challenger;
        next.winReason = "placement";
      }
    } else {
      next.pending = {
        kind: "choose", outcome: "correct", chooser: challenger, challenger, offender,
        options: ["take-turn", "force-move"],
      };
    }
    return { ok: true, state: next };
  }

  // Incorrect: the move stands, and the challenger gets a strike.
  const next = copyState(state);
  next.strikes[challenger] += 1;
  entry.strike = next.strikes[challenger];
  next.moveLog.push(entry);
  next.lastTurn = null;

  if (next.strikes[challenger] >= STRIKES_TO_LOSE) {
    next.phase = "gameover";
    next.winner = offender;
    next.winReason = "strikes";
  } else if (info.kind === "placement") {
    next.pending = { kind: "move-chip", chooser: offender, challenger, offender };
  } else {
    next.pending = {
      kind: "choose", outcome: "incorrect", chooser: offender, challenger, offender,
      options: ["lose-turn", "force-move"],
    };
  }
  return { ok: true, state: next };
}

// The game as it was before the last move, keeping what a challenge must not
// undo: the strikes, the written log, and whether time has been called.
function restoreBeforeLastMove(state) {
  const restored = restoreSnapshot(state, state.history.length - 1);
  restored.strikes = { ...state.strikes };
  restored.moveLog = structuredClone(state.moveLog);
  restored.timeCalled = state.timeCalled;
  restored.timeEndsAfter = state.timeEndsAfter;
  return restored;
}

// ---------------------------------------------------------------------------
// The choices that follow
// ---------------------------------------------------------------------------

// Choose after a challenge on a movement rule.
//   correct:   the challenger "take-turn" (take their own turn) or "force-move"
//              (make the offender move a pentomino)
//   incorrect: the challenged player "lose-turn" (the challenger loses the turn)
//              or "force-move" (make the challenger move a pentomino)
export function decide(state, choice) {
  const pending = state.pending;
  if (!pending || pending.kind !== "choose") return fail("There is nothing to decide right now.");
  if (!pending.options.includes(choice)) return fail("That isn't one of the choices.");

  const next = copyState(state);
  next.pending = null;
  next.lastTurn = null;
  next.moveLog.push({ type: "decision", player: pending.chooser, choice, outcome: pending.outcome, challenger: pending.challenger, offender: pending.offender });

  if (pending.outcome === "correct") {
    if (choice === "take-turn") {
      next.currentPlayer = pending.challenger;
    } else {
      next.currentPlayer = pending.offender;
      next.mustMovePiece = true;
    }
  } else if (choice === "lose-turn") {
    next.currentPlayer = pending.offender;
  } else {
    next.currentPlayer = pending.challenger;
    next.mustMovePiece = true;
  }

  // If no pentomino could possibly move, the player can't be made to move one.
  if (next.mustMovePiece && getPossibleMoves(next).length === 0) next.mustMovePiece = false;

  checkStuckPlayer(next);
  return { ok: true, state: next };
}

// After a correct challenge on a placement, the challenger places one of the
// opponent's pieces for them. It must be a legal placement. Takes the same
// move as a normal placement: { type: "place", shape, cells }.
export function placeForOpponent(state, move) {
  const pending = state.pending;
  if (!pending || pending.kind !== "place-for") return fail("There is nothing to place right now.");

  const owner = pending.offender;
  if (!state.unusedShapes[owner].includes(move.shape)) return fail("That piece has already been placed.");

  const known = orientations(getShapeCells(move.shape)).map((cells) => shapeKey(cells));
  if (!known.includes(shapeKey(move.cells))) return fail("Those squares don't make that shape.");

  const analysis = analyzePlacement(state, owner, move.cells);
  if (!analysis.legal) return fail(analysis.message);

  const next = copyState(state);
  const cells = move.cells.map(([row, col]) => [row, col]);
  next.pieces.push({ id: next.nextPieceId, owner, shape: move.shape, cells });
  next.nextPieceId += 1;
  next.unusedShapes[owner] = next.unusedShapes[owner].filter((name) => name !== move.shape);
  next.placedCount[owner] += 1;
  next.moveLog.push({ type: "place", player: owner, shape: move.shape, cells, placedBy: pending.chooser });

  next.pending = null;
  next.lastTurn = null;
  next.currentPlayer = pending.challenger; // the challenger now takes their own turn

  if (next.placedCount[1] === PIECES_PER_PLAYER && next.placedCount[2] === PIECES_PER_PLAYER) {
    next.phase = "movement";
  }

  checkStuckPlayer(next);
  return { ok: true, state: next };
}

// After an incorrect challenge on a placement, the challenged player moves one
// of the challenger's chips to any empty square that isn't a star.
//   { type: "relocate-chip", chipId, to: { row, col } }
export function relocateChip(state, move) {
  const pending = state.pending;
  if (!pending || pending.kind !== "move-chip") return fail("There is no chip to move right now.");

  const chip = state.chips.find((candidate) => candidate.id === move.chipId);
  if (!chip || chip.owner !== pending.challenger) return fail("Pick one of " + "the other player's chips.");

  const to = move.to;
  if (!to || !Number.isInteger(to.row) || !Number.isInteger(to.col) || !isOnBoard(to.row, to.col)) {
    return fail("That square isn't on the board.");
  }
  if (to.row === chip.row && to.col === chip.col) return fail("Move the chip to a new square.");
  if (occupiedSquares(state, { chipId: chip.id }).has(squareKey(to.row, to.col))) return fail("That square is taken.");
  if (isStar(to.row, to.col)) return fail("A chip can't go on a star.");

  const next = copyState(state);
  const moved = next.chips.find((candidate) => candidate.id === chip.id);
  const from = { row: moved.row, col: moved.col };
  moved.row = to.row;
  moved.col = to.col;
  next.moveLog.push({ type: "relocate-chip", player: pending.chooser, chipId: chip.id, from, to: { row: to.row, col: to.col } });

  next.pending = null;
  next.lastTurn = null;
  next.currentPlayer = pending.challenger; // the challenger now takes their own turn

  checkStuckPlayer(next);
  return { ok: true, state: next };
}

// ---------------------------------------------------------------------------
// Challenging a declared win
// ---------------------------------------------------------------------------

// The loser of a game that ended by a placement forfeit or by entrapment may
// challenge the win once. The button is offered every time (so it doesn't give
// anything away); it is only correct if the winner's last move broke a rule.
export function canChallengeWin(state) {
  return state.phase === "gameover"
    && challengesEnabled(state)
    && (state.winReason === "placement" || state.winReason === "entrapment")
    && !state.winChallenged
    && state.lastTurn !== null
    && state.lastTurn.player === state.winner;
}

export function challengeWin(state) {
  if (!canChallengeWin(state)) return fail("The win can't be challenged.");

  const challenger = otherPlayer(state.winner);
  const correct = state.lastTurn.violations.length > 0;

  const next = copyState(state);
  next.winChallenged = true;
  next.moveLog.push({ type: "challenge-win", player: challenger, correct });
  if (correct) {
    next.winner = challenger;
    next.winReason = "declared-win";
  }
  return { ok: true, state: next };
}
