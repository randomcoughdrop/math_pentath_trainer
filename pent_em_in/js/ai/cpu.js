// The computer opponent. It only ever returns moves; the game decides what they do.
//   nextCpuMove(state, params, rng) - whatever the CPU should do right now, or null
// Moves come from the same functions the human's clicks use, so the CPU can
// never do anything a person couldn't.

import { getPossiblePlacements, getPossibleMoves, getLegalPlacements } from "../moves.js";
import { canChallenge, canChallengeWin } from "../challenges.js";
import { challengesEnabled, isStar, occupiedSquares, squareKey } from "../rules.js";
import { COLS, ROWS } from "../constants.js";
import { searchMove } from "./search.js";
import { pickRandom } from "./random.js";

// --- choosing a move on its own turn ---

export function chooseMove(state, params, rng = Math.random) {
  return state.phase === "placement"
    ? choosePlacement(state, params, rng)
    : chooseMovement(state, params, rng);
}

// Random shape, orientation, and position. Sometimes (Medium) a rule-breaking one.
function choosePlacement(state, params, rng) {
  const player = state.currentPlayer;
  const possible = getPossiblePlacements(state, player);
  const legal = possible.filter((placement) => placement.analysis.legal);
  const broken = possible.filter((placement) => !placement.analysis.legal);

  const pool = wantsToBreakRules(state, params, rng, broken) ? broken : legal;
  const choices = pool.length > 0 ? pool : possible;
  if (choices.length === 0) return null;

  // Pick the shape first, so shapes with many positions aren't favored.
  const shape = pickRandom([...new Set(choices.map((placement) => placement.shape))], rng);
  const chosen = pickRandom(choices.filter((placement) => placement.shape === shape), rng);
  return { type: "place", shape: chosen.shape, cells: chosen.cells };
}

function chooseMovement(state, params, rng) {
  const possible = getPossibleMoves(state);
  const legal = possible.filter(({ analysis }) => analysis.legal).map(({ move }) => move);
  const broken = possible.filter(({ analysis }) => !analysis.legal).map(({ move }) => move);

  if (wantsToBreakRules(state, params, rng, broken)) return pickRandom(broken, rng);
  if (legal.length === 0) return broken.length > 0 && challengesEnabled(state) ? pickRandom(broken, rng) : null;
  if (rng() < params.randomMoveRate) return pickRandom(legal, rng);
  return searchMove(state, legal, params.searchDepth, rng);
}

function wantsToBreakRules(state, params, rng, broken) {
  return challengesEnabled(state) && broken.length > 0 && rng() < params.illegalMoveRate;
}

// --- challenging ---

// Does the CPU challenge the human's last turn? Returns the category, or null.
// It only challenges a turn that really broke a rule, and only some of the time.
export function shouldChallenge(state, params, rng = Math.random) {
  if (!canChallenge(state)) return null;
  const violations = state.lastTurn.violations;
  if (violations.length === 0 || rng() >= params.challengeRate) return null;
  return violations.includes("piece-repeat") ? "piece-repeat" : violations[0];
}

// Does the CPU, having lost, challenge the human's winning move?
export function shouldChallengeWin(state, params, rng = Math.random) {
  return canChallengeWin(state)
    && state.lastTurn.violations.length > 0
    && rng() < params.challengeRate;
}

// --- the choices after a challenge ---

function respondToPending(state, rng) {
  const pending = state.pending;

  if (pending.kind === "choose") {
    return { type: "decide", choice: pickRandom(pending.options, rng) };
  }

  if (pending.kind === "place-for") {
    const options = getLegalPlacements(state, pending.offender);
    if (options.length === 0) return null;
    const chosen = pickRandom(options, rng);
    return { type: "place", shape: chosen.shape, cells: chosen.cells };
  }

  // move-chip: move one of the challenger's chips to any empty square that isn't a star.
  const chip = pickRandom(state.chips.filter((candidate) => candidate.owner === pending.challenger), rng);
  const taken = occupiedSquares(state, { chipId: chip.id });
  const squares = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const here = row === chip.row && col === chip.col;
      if (!here && !isStar(row, col) && !taken.has(squareKey(row, col))) squares.push({ row, col });
    }
  }
  return squares.length === 0 ? null : { type: "relocate-chip", chipId: chip.id, to: pickRandom(squares, rng) };
}

// --- the one entry point ---

// Whatever the CPU should do right now (the caller has checked it is the CPU's
// turn to act, see players.js). Returns a move for applyMove, or null.
export function nextCpuMove(state, params, rng = Math.random) {
  if (state.phase === "gameover") {
    return shouldChallengeWin(state, params, rng) ? { type: "challenge-win" } : null;
  }
  if (state.pending) return respondToPending(state, rng);

  const category = shouldChallenge(state, params, rng);
  if (category) return { type: "challenge", category };

  return chooseMove(state, params, rng);
}
