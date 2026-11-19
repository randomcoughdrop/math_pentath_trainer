// Turn flow, phases, and win detection: placement, movement, and running out of time.

import { PIECES_PER_PLAYER } from "./constants.js";
import { getShapeCells } from "./pieces.js";
import { orientations, shapeKey } from "./transforms.js";
import { analyzeMove, analyzePlacement, isAllowed } from "./analyze.js";
import { copyState, otherPlayer } from "./state.js";
import { checkPlacementForfeit, checkEntrapment } from "./turn.js";
import { cellsAfterMove } from "./rules.js";
import { recordSnapshot } from "./history.js";
import { challenge, decide, placeForOpponent, relocateChip, challengeWin } from "./challenges.js";

// Play a move for the current player. Never changes the state it is given.
// Returns { ok: true, state } with the new state, or { ok: false, message }.
export function applyMove(state, move) {
  // After the game: the loser may challenge a declared win.
  if (state.phase === "gameover") {
    if (move.type === "challenge-win") return challengeWin(state);
    return { ok: false, message: "The game is over." };
  }

  // A challenge is waiting for someone's choice: only that choice is possible.
  if (state.pending) {
    if (move.type === "decide") return decide(state, move.choice);
    if (move.type === "place") return placeForOpponent(state, move);
    if (move.type === "relocate-chip") return relocateChip(state, move);
    return { ok: false, message: "Finish the challenge first." };
  }

  if (move.type === "challenge") return challenge(state, move.category);

  if (state.phase === "placement" && move.type === "place") {
    return applyPlacement(state, move);
  }
  if (state.phase === "movement" && ["slide", "rotate", "flip", "chip"].includes(move.type)) {
    return applyMovement(state, move);
  }
  return { ok: false, message: "That isn't possible right now." };
}

function applyPlacement(state, move) {
  const player = state.currentPlayer;

  if (!state.unusedShapes[player].includes(move.shape)) {
    return { ok: false, message: "That piece has already been placed." };
  }

  // The squares must really be that shape, in some turned or flipped position.
  const known = orientations(getShapeCells(move.shape)).map((cells) => shapeKey(cells));
  if (!known.includes(shapeKey(move.cells))) {
    return { ok: false, message: "Those squares don't make that shape." };
  }

  const analysis = analyzePlacement(state, player, move.cells);
  if (!isAllowed(state, analysis)) {
    return { ok: false, message: analysis.message };
  }

  const next = copyState(state);
  const cells = move.cells.map(([row, col]) => [row, col]);

  recordSnapshot(next, state);
  next.pieces.push({ id: next.nextPieceId, owner: player, shape: move.shape, cells });
  next.nextPieceId += 1;
  next.unusedShapes[player] = next.unusedShapes[player].filter((name) => name !== move.shape);
  next.placedCount[player] += 1;
  next.moveLog.push({ type: "place", player, shape: move.shape, cells });
  next.lastTurn = { player, move: { type: "place", shape: move.shape, cells }, violations: analysis.violations };
  next.mustMovePiece = false;
  next.forcedBy = null;

  startNextTurn(next, player);
  return { ok: true, state: next };
}

// Slide, rotate, flip, or chip move for the current player.
function applyMovement(state, move) {
  const player = state.currentPlayer;

  const analysis = analyzeMove(state, move);
  if (!isAllowed(state, analysis)) {
    return { ok: false, message: analysis.message };
  }

  const next = copyState(state);
  recordSnapshot(next, state);

  if (move.type === "chip") {
    const chip = next.chips.find((candidate) => candidate.id === move.chipId);
    const from = { row: chip.row, col: chip.col };
    chip.row = move.to.row;
    chip.col = move.to.col;

    // Moving a chip doesn't break a piece streak, but it is remembered so a
    // second chip move in a row can be spotted.
    next.lastWasChipMove[player] = true;
    next.moveLog.push({ type: "chip", player, chipId: chip.id, from, to: { ...move.to } });
  } else {
    const piece = next.pieces.find((candidate) => candidate.id === move.pieceId);
    const from = piece.cells;
    piece.cells = cellsAfterMove(from, move);

    // A move chosen by the opponent (after a challenge) is not the player's own
    // turn, so it doesn't count toward their streak.
    if (!state.forcedBy) {
      const streak = next.repeat[player];
      if (streak.pieceId === piece.id) {
        streak.count += 1;
      } else {
        streak.pieceId = piece.id;
        streak.count = 1;
      }
      next.lastWasChipMove[player] = false;
    }

    const entry = { ...move, player, shape: piece.shape, from, to: piece.cells };
    if (state.forcedBy) entry.forcedBy = state.forcedBy;
    next.moveLog.push(entry);
  }

  // A forced move can't be challenged: the player who chose it isn't in a position to.
  next.lastTurn = state.forcedBy ? null : { player, move: { ...move }, violations: analysis.violations };
  next.mustMovePiece = false;
  next.forcedBy = null;

  startNextTurn(next, player);
  return { ok: true, state: next };
}

// Pass the turn, check whether that ends the game, and apply the time limit if
// it has been called.
function startNextTurn(state, playerWhoJustMoved) {
  passTurn(state, playerWhoJustMoved);

  // A win by the rules comes first; otherwise the called time ends the game.
  if (state.phase !== "gameover" && state.timeCalled && playerWhoJustMoved === state.timeEndsAfter) {
    state.phase = "gameover";
    state.winner = null;
    state.winReason = "time";
  }
}

// Hand the turn to the other player, then check what that means: placement
// may be over, or the next player may be stuck.
function passTurn(state, playerWhoJustMoved) {
  state.currentPlayer = otherPlayer(playerWhoJustMoved);

  if (state.phase === "placement") {
    const done = state.placedCount[1] === PIECES_PER_PLAYER && state.placedCount[2] === PIECES_PER_PLAYER;
    if (!done) {
      checkPlacementForfeit(state);
      return;
    }
    state.phase = "movement";
  }

  checkEntrapment(state);
}

// ---------------------------------------------------------------------------
// Running out of time (the page's clock calls these)
// ---------------------------------------------------------------------------

// The game cap ran out (Easy and Medium). The player on the move finishes their
// turn. If that player moved first in the game, the other player gets one more
// turn so that both have had the same number. Then the game is a tie, unless
// someone wins on the way. Returns a new state.
export function callTime(state) {
  if (state.phase === "gameover" || state.timeCalled) return state;

  const next = copyState(state);
  next.timeCalled = true;
  next.timeEndsAfter = state.currentPlayer === state.startingPlayer
    ? otherPlayer(state.currentPlayer)
    : state.currentPlayer;
  return next;
}

// A player's chess clock reached zero (Hard): they lose. Returns a new state.
export function loseOnTime(state, player) {
  if (state.phase === "gameover") return state;

  const next = copyState(state);
  next.phase = "gameover";
  next.winner = otherPlayer(player);
  next.winReason = "time";
  return next;
}
