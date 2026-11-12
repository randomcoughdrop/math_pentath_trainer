// Scores a position for one player: the higher, the better for them.
//
// The game is won by leaving the opponent with no piece that can move, so the
// score is about freedom to move: how many legal moves each side has, and how
// close each side's pieces are to being stuck.

import { otherPlayer } from "../state.js";
import { mobility } from "./mobility.js";

// The weights. Change these to change how the CPU plays.
export const WEIGHTS = {
  pieceMoves: 1,       // each legal move of a piece, for me (and against, for them)
  chipMoves: 0.25,     // chip moves matter less: they can't win the game, only help block
  nearlyStuck: 5,      // a piece with only 1 or 2 moves left (theirs is good for me, mine is bad)
  win: 10000,          // the opponent has no piece that can move
  loss: -500,          // I have no piece that can move (it is not my turn yet, so not quite lost)
};
const NEARLY_STUCK = 2; // "only a few moves" means this many or fewer

function nearlyStuckCount(perPiece) {
  let count = 0;
  for (const moves of perPiece.values()) if (moves <= NEARLY_STUCK) count++;
  return count;
}

// `state` is any position (see afterMove in mobility.js); `me` is whose view.
// Each player's moves are counted as if it were their turn, with their own
// streaks applied, so a piece that has moved twice in a row counts as having no
// moves, which is the "don't be forced into a third repeat" penalty.
export function evaluate(state, me) {
  const mine = mobility(state, me);
  const theirs = mobility(state, otherPlayer(me));

  if (theirs.pieceTotal === 0 && theirs.perPiece.size > 0) return WEIGHTS.win;

  let score = WEIGHTS.pieceMoves * (mine.pieceTotal - theirs.pieceTotal);
  score += WEIGHTS.chipMoves * (mine.chipTotal - theirs.chipTotal);
  score += WEIGHTS.nearlyStuck * (nearlyStuckCount(theirs.perPiece) - nearlyStuckCount(mine.perPiece));
  if (mine.pieceTotal === 0 && mine.perPiece.size > 0) score += WEIGHTS.loss;
  return score;
}
