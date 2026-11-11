// Small, single-purpose rule checks (pure logic, no drawing).

import { COLS, ROWS, STARS } from "./constants.js";
import { SIDES, slideCells, rotateAboutVertex, flipOverSide, externalCorners } from "./transforms.js";

// The four directions a piece can slide: [row change, column change].
export const DIRECTIONS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

// A chip moves like a queen: these eight directions.
export const CHIP_DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

// A square as text, so squares can be kept in a Set.
export function squareKey(row, col) {
  return row + "," + col;
}

export function isOnBoard(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

const STAR_KEYS = new Set(STARS.map((star) => squareKey(star.row, star.col)));

export function isStar(row, col) {
  return STAR_KEYS.has(squareKey(row, col));
}

// Every square currently taken by a chip or a piece. To ask "what is in the
// way of this piece (or chip)?", leave that piece or chip out with
// except = { pieceId } or { chipId }.
export function occupiedSquares(state, except = {}) {
  const taken = new Set();
  for (const chip of state.chips) {
    if (chip.id === except.chipId) continue;
    taken.add(squareKey(chip.row, chip.col));
  }
  for (const piece of state.pieces) {
    if (piece.id === except.pieceId) continue;
    for (const [row, col] of piece.cells) taken.add(squareKey(row, col));
  }
  return taken;
}

// Where a piece's cells end up after a slide, rotate, or flip move.
// Returns null if the move isn't well formed (a bad direction, a pivot that
// isn't an external corner of the piece, and so on).
//   slide:  { type: "slide", pieceId, direction: "up"|"down"|"left"|"right", distance }
//   rotate: { type: "rotate", pieceId, pivot: [row, col], quarterTurns: 1|2|3 }
//   flip:   { type: "flip", pieceId, side: "top"|"bottom"|"left"|"right" }
export function cellsAfterMove(cells, move) {
  if (move.type === "slide") {
    if (!Object.hasOwn(DIRECTIONS, move.direction)) return null;
    if (!Number.isInteger(move.distance) || move.distance < 1) return null;
    const [stepRow, stepCol] = DIRECTIONS[move.direction];
    return slideCells(cells, stepRow * move.distance, stepCol * move.distance);
  }

  if (move.type === "rotate") {
    if (![1, 2, 3].includes(move.quarterTurns)) return null;
    const pivot = move.pivot;
    if (!Array.isArray(pivot)) return null;
    const isCorner = externalCorners(cells).some(([row, col]) => row === pivot[0] && col === pivot[1]);
    if (!isCorner) return null;
    return rotateAboutVertex(cells, pivot, move.quarterTurns);
  }

  if (move.type === "flip") {
    if (!SIDES.includes(move.side)) return null;
    return flipOverSide(cells, move.side);
  }

  return null;
}

// Does any square of `cells` share an edge with a piece that belongs to the
// other player? (Touching only at a corner does not count.)
export function touchesOpponentPiece(state, cells, player) {
  const theirs = new Set();
  for (const piece of state.pieces) {
    if (piece.owner === player) continue;
    for (const [row, col] of piece.cells) theirs.add(squareKey(row, col));
  }

  return cells.some(([row, col]) =>
    [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
      .some(([nextRow, nextCol]) => theirs.has(squareKey(nextRow, nextCol))));
}

// Should a rule-breaking move be refused outright? Easy says yes. Medium and
// Hard will say no (Phase 6 reads the difficulty here). Until then every level
// refuses them.
export function blocksViolations(state) {
  return true;
}
