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
  let best = sorted.filter((entry) => entry.score === sorted[0].score);
  // A half turn that scores exactly like a flip is the same idea; play the flip.
  if (best.some((entry) => entry.item.type === "flip")) {
    best = best.filter((entry) => !(entry.item.type === "rotate" && entry.item.quarterTurns === 2));
  }
  return pickRandom(best, rng).item;
}

// Choose among legal moves for the player to move.
export function searchMove(state, legalMoves, params, rng) {
  const me = state.currentPlayer;
  const scored = legalMoves.map((move) => ({ item: move, score: evaluate(afterMove(state, move), me) }));
  return chooseByScore(scored, params, rng);
}

// ---------------------------------------------------------------------------
// Deep search (Phase 9)
// ---------------------------------------------------------------------------
// Minimax with alpha-beta pruning, on the fast engine in engine.js. It always
// scores positions from the point of view of the player who is choosing (`me`):
// on my turns it picks the highest score, on my opponent's the lowest.
//
// It looks one move deeper each time (iterative deepening) until it reaches
// `maxDepth` or runs out of time, and keeps the answer from the last depth it
// finished. Moves are tried best-first (by a quick look at the position each
// leads to), which lets alpha-beta skip most of the tree.

import { buildPosition, generateMoves, makeMove, unmakeMove, moveToObject, staticScore } from "./engine.js";
import { WEIGHTS } from "./evaluate.js";

const MAX_MOVES = 2048; // more than any position has

// Returns { scored: [{ move, score }] best first, depth, nodes, timedOut } or
// null if the player has no moves. `scored` holds the best `topK` moves (and any
// that tie with the last of them), with exact scores.
//   maxDepth   - the most moves to look ahead (this player's and the opponent's)
//   minDepth   - always look at least this deep if at all possible (it may take up
//                to three times the budget before giving up on one)
//   budgetMs   - past minDepth, only go deeper while the next depth is expected to
//                finish within this long overall (Infinity: no limit)
//   topK       - how many top moves need exact scores (for near-best picks)
//   piecesOnly - chip moves are not allowed this turn
export function searchPosition(state, { maxDepth, minDepth = 1, budgetMs = Infinity, topK = 1, piecesOnly = false }) {
  const pos = buildPosition(state);
  const me = state.currentPlayer;
  const them = me === 1 ? 2 : 1;
  const ctx = {
    pos, me, nodes: 0, timedOut: false, deadline: Infinity,
    stacks: [], scores: [], undos: [],
  };
  for (let ply = 0; ply <= maxDepth + 1; ply++) {
    ctx.stacks.push(new Int32Array(MAX_MOVES));
    ctx.scores.push(new Float64Array(MAX_MOVES));
    ctx.undos.push(new Int32Array(8));
  }

  const rootMoves = new Int32Array(MAX_MOVES);
  const count = generateMoves(pos, me, rootMoves, piecesOnly);
  if (count === 0) return null;
  let order = Array.from(rootMoves.subarray(0, count));
  let best = null;
  let reached = 0;
  const started = performance.now();
  let lastTook = 1;

  for (let depth = 1; depth <= maxDepth; depth++) {
    // Depth 1 is cheap, so it always finishes. Up to minDepth the search is given
    // extra time; deeper than that it is cut off at the budget.
    ctx.deadline = depth === 1 ? Infinity : started + (depth <= minDepth ? budgetMs * 3 : budgetMs);
    ctx.timedOut = false;
    const roundStart = performance.now();
    const round = searchRoot(ctx, order, depth, topK, them, ctx.undos[maxDepth + 1]);
    if (ctx.timedOut) break;
    best = round.exact;
    order = round.order;
    reached = depth;
    if (best[0].score >= WEIGHTS.win) break; // a forced win: no need to look deeper

    // Each depth takes a few times longer than the one before. Only start the
    // next if it is expected to finish in time, instead of wasting the effort.
    const took = Math.max(performance.now() - roundStart, 1);
    const growth = depth >= 2 ? Math.max(2, took / lastTook) : 4;
    lastTook = took;
    if (depth >= minDepth && performance.now() - started + took * growth > budgetMs) break;
  }

  return {
    scored: best.map(({ move, score }) => ({ move: moveToObject(pos, move), score })),
    depth: reached,
    nodes: ctx.nodes,
    timedOut: ctx.timedOut,
  };
}

function searchRoot(ctx, order, depth, topK, them, undo) {
  const { pos, me } = ctx;
  const exact = [];
  const others = [];
  let alpha = -Infinity;

  for (const move of order) {
    makeMove(pos, move, me, undo);
    const value = alphabeta(ctx, depth - 1, alpha, Infinity, them);
    unmakeMove(pos, move, me, undo);
    if (ctx.timedOut) return {};

    if (value > alpha) {
      exact.push({ move, score: value });
      if (exact.length >= topK) {
        exact.sort((a, b) => b.score - a.score);
        // Anything that can't beat (or tie) the k-th best is of no interest.
        alpha = exact[topK - 1].score - 0.01;
      }
    } else {
      others.push({ move, score: value });
    }
  }

  exact.sort((a, b) => b.score - a.score);
  others.sort((a, b) => b.score - a.score);
  return { exact, order: [...exact, ...others].map((entry) => entry.move) };
}

function alphabeta(ctx, depth, alpha, beta, side) {
  const { pos, me } = ctx;
  if ((++ctx.nodes & 1023) === 0 && performance.now() > ctx.deadline) ctx.timedOut = true;
  if (ctx.timedOut) return 0;
  if (depth === 0) return staticScore(pos, me, side);

  const moves = ctx.stacks[depth];
  const count = generateMoves(pos, side, moves);
  // A player with no piece that can move has lost. Sooner is better for the winner.
  if (pos.stats[0] === 0) return side === me ? -(WEIGHTS.win + depth) : WEIGHTS.win + depth;

  const other = side === 1 ? 2 : 1;
  const undo = ctx.undos[depth];
  const maximizing = side === me;

  // With two or more moves still to go, a quick look at each move's result lets
  // the best ones be tried first. The scores are picked from lazily, because
  // usually only the first few moves are needed before the rest are pruned.
  const ordered = depth >= 2;
  const scores = ctx.scores[depth];
  if (ordered) {
    for (let i = 0; i < count; i++) {
      makeMove(pos, moves[i], side, undo);
      scores[i] = staticScore(pos, me, other);
      unmakeMove(pos, moves[i], side, undo);
    }
  }

  let best = maximizing ? -Infinity : Infinity;
  for (let i = 0; i < count; i++) {
    if (ordered) {
      // Bring the best remaining move to position i.
      let pick = i;
      for (let j = i + 1; j < count; j++) {
        if (maximizing ? scores[j] > scores[pick] : scores[j] < scores[pick]) pick = j;
      }
      if (pick !== i) {
        [moves[i], moves[pick]] = [moves[pick], moves[i]];
        [scores[i], scores[pick]] = [scores[pick], scores[i]];
      }
    }

    makeMove(pos, moves[i], side, undo);
    const value = alphabeta(ctx, depth - 1, alpha, beta, other);
    unmakeMove(pos, moves[i], side, undo);
    if (ctx.timedOut) return 0;

    if (maximizing) {
      if (value > best) best = value;
      if (best > alpha) alpha = best;
    } else {
      if (value < best) best = value;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}
