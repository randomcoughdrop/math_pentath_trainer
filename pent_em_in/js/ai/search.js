// Looks ahead through possible moves: shallow search first, then minimax (Phases 8 and 9).

import { pickRandom } from "./random.js";

// Choose among legal moves. Until Phase 8 this has no opinion and picks at random.
//   depth - how far to look ahead (not used yet)
export function searchMove(state, legalMoves, depth, rng) {
  return pickRandom(legalMoves, rng);
}
