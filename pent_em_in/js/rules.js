// Small, single-purpose rule checks (pure logic, no drawing).

import { COLS, ROWS, STARS } from "./constants.js";

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

// Every square currently taken by a chip or a piece.
export function occupiedSquares(state) {
  const taken = new Set();
  for (const chip of state.chips) taken.add(squareKey(chip.row, chip.col));
  for (const piece of state.pieces) {
    for (const [row, col] of piece.cells) taken.add(squareKey(row, col));
  }
  return taken;
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
