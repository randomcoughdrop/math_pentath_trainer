// Picks a move by looking one move ahead: try each legal move, score the
// position it leads to, and prefer the best. (Deeper search comes in Phase 9.)

import { evaluate } from "./evaluate.js";
import { afterMove } from "./mobility.js";
import { pickRandom } from "./random.js";

// How the result is chosen from the scored options ({ item, score }):
//   most of the time: one of the best (ties broken at random)
//   nearBestRate of the time: one of the next three best, a "near-best" move
// params.nearBestRate is 0 at level 100, so the top level always plays the best.
export function chooseByScore(scored, params, rng) {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  if (sorted.length > 1 && rng() < params.nearBestRate) {
    return pickRandom(sorted.slice(1, 4), rng).item;
  }
  const best = sorted.filter((entry) => entry.score === sorted[0].score);
  return pickRandom(best, rng).item;
}

// Choose among legal moves for the player to move.
export function searchMove(state, legalMoves, params, rng) {
  const me = state.currentPlayer;
  const scored = legalMoves.map((move) => ({ item: move, score: evaluate(afterMove(state, move), me) }));
  return chooseByScore(scored, params, rng);
}
