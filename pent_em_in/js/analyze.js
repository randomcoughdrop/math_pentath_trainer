// analyzeMove(): is a move possible, and which rules does it break?
//
// "Possible" means the move physically works: every square is on the board and
// none lands on a chip or another piece. That is never allowed to fail.
//
// "Violations" are rules the move breaks even though it is possible. Easy
// refuses these; Medium and Hard let them through to be challenged (Phase 6).

import {
  isOnBoard, isStar, occupiedSquares, squareKey, touchesOpponentPiece, blocksViolations,
  cellsAfterMove, DIRECTIONS,
} from "./rules.js";
import { slideCells } from "./transforms.js";

// Plain-English reasons, shown in the status line.
export const MESSAGES = {
  offBoard: "That doesn't fit on the board.",
  overlap: "That overlaps a chip or another piece.",
  "placement-star": "A piece can't be placed on a star.",
  "placement-contact": "A piece can't touch the other player's piece along an edge.",
  notYours: "That isn't one of your pieces or chips.",
  badMove: "That isn't a move a piece or chip can make.",
  "slide-blocked": "A piece can't slide over a chip, a piece, or a star.",
  "star-landing": "A piece can't land on a star.",
  "chip-blocked": "A chip can't pass over a piece, a chip, or a star, or land on a star.",
  "chip-repeat": "You can't move a chip two turns in a row.",
  mustMovePiece: "You have to move a pentomino this turn, not a chip.",
  "piece-repeat": "You can't move the same piece three turns in a row.",
};

// Check where `player` wants to place a piece covering `cells`.
// Returns { possible, violations, legal, message }:
//   possible   - fits on the board without overlapping anything
//   violations - rule categories broken, such as "placement-star"
//   legal      - possible, with no violations
//   message    - the first problem in words, or "" if there is none
export function analyzePlacement(state, player, cells) {
  const messages = [];
  let possible = true;

  if (cells.some(([row, col]) => !isOnBoard(row, col))) {
    possible = false;
    messages.push(MESSAGES.offBoard);
  }

  const taken = occupiedSquares(state);
  if (cells.some(([row, col]) => taken.has(squareKey(row, col)))) {
    possible = false;
    messages.push(MESSAGES.overlap);
  }

  const violations = [];
  if (cells.some(([row, col]) => isStar(row, col))) violations.push("placement-star");
  if (touchesOpponentPiece(state, cells, player)) violations.push("placement-contact");
  for (const category of violations) messages.push(MESSAGES[category]);

  return {
    possible,
    violations,
    legal: possible && violations.length === 0,
    message: messages[0] ?? "",
  };
}

// A move that can't even be described properly (not your piece, a made-up direction).
function invalid(message) {
  return { possible: false, violations: [], legal: false, message };
}

// Check a slide, rotate, or flip of one of the player's pieces.
export function analyzePieceMove(state, player, move) {
  const piece = state.pieces.find((candidate) => candidate.id === move.pieceId);
  if (!piece || piece.owner !== player) return invalid(MESSAGES.notYours);

  const cells = cellsAfterMove(piece.cells, move);
  if (!cells) return invalid(MESSAGES.badMove);

  let possible = true;
  const messages = [];
  const taken = occupiedSquares(state, { pieceId: piece.id });

  if (cells.some(([row, col]) => !isOnBoard(row, col))) {
    possible = false;
    messages.push(MESSAGES.offBoard);
  }
  if (cells.some(([row, col]) => taken.has(squareKey(row, col)))) {
    possible = false;
    messages.push(MESSAGES.overlap);
  }

  const violations = [];

  // A slide must have a clear path: at every step along the way the piece may
  // not cover a chip, a piece, or a star. (Rotating and flipping may sweep over them.)
  if (move.type === "slide") {
    const [stepRow, stepCol] = DIRECTIONS[move.direction];
    for (let step = 1; step < move.distance; step++) {
      const along = slideCells(piece.cells, stepRow * step, stepCol * step);
      if (along.some(([row, col]) => taken.has(squareKey(row, col)) || isStar(row, col))) {
        violations.push("slide-blocked");
        break;
      }
    }
  }

  if (cells.some(([row, col]) => isStar(row, col))) violations.push("star-landing");

  // Moving the same piece a third turn in a row.
  const streak = state.repeat[player];
  if (streak.pieceId === piece.id && streak.count >= 2) violations.push("piece-repeat");

  for (const category of violations) messages.push(MESSAGES[category]);

  return { possible, violations, legal: possible && violations.length === 0, message: messages[0] ?? "" };
}

// Check moving one of the player's chips: { type: "chip", chipId, to: { row, col } }.
export function analyzeChipMove(state, player, move) {
  const chip = state.chips.find((candidate) => candidate.id === move.chipId);
  if (!chip || chip.owner !== player) return invalid(MESSAGES.notYours);
  if (state.mustMovePiece) return invalid(MESSAGES.mustMovePiece);

  const to = move.to;
  if (!to || !Number.isInteger(to.row) || !Number.isInteger(to.col)) return invalid(MESSAGES.badMove);

  // Like a queen: along a row, a column, or a diagonal.
  const rowChange = to.row - chip.row;
  const colChange = to.col - chip.col;
  const steps = Math.max(Math.abs(rowChange), Math.abs(colChange));
  const straight = rowChange === 0 || colChange === 0 || Math.abs(rowChange) === Math.abs(colChange);
  if (steps === 0 || !straight) return invalid(MESSAGES.badMove);

  let possible = true;
  const messages = [];
  const taken = occupiedSquares(state, { chipId: chip.id });

  if (!isOnBoard(to.row, to.col)) {
    possible = false;
    messages.push(MESSAGES.offBoard);
  }
  if (taken.has(squareKey(to.row, to.col))) {
    possible = false;
    messages.push(MESSAGES.overlap);
  }

  const violations = [];

  // Squares passed over must be empty and star-free; the landing square must not be a star.
  const stepRow = Math.sign(rowChange);
  const stepCol = Math.sign(colChange);
  for (let step = 1; step <= steps; step++) {
    const row = chip.row + stepRow * step;
    const col = chip.col + stepCol * step;
    const passedOver = step < steps;
    if (isStar(row, col) || (passedOver && taken.has(squareKey(row, col)))) {
      violations.push("chip-blocked");
      break;
    }
  }

  if (state.lastWasChipMove[player]) violations.push("chip-repeat");

  for (const category of violations) messages.push(MESSAGES[category]);

  return { possible, violations, legal: possible && violations.length === 0, message: messages[0] ?? "" };
}

// Analyze any move for the player whose turn it is.
export function analyzeMove(state, move) {
  if (move.type === "place") {
    return analyzePlacement(state, state.currentPlayer, move.cells);
  }
  if (move.type === "slide" || move.type === "rotate" || move.type === "flip") {
    return analyzePieceMove(state, state.currentPlayer, move);
  }
  if (move.type === "chip") {
    return analyzeChipMove(state, state.currentPlayer, move);
  }
  throw new Error("analyzeMove: unknown move type '" + move.type + "'");
}

// May this move actually be played? Impossible moves never can. Rule-breaking
// moves can only if the current difficulty lets them through.
export function isAllowed(state, analysis) {
  if (!analysis.possible) return false;
  // A move chosen for someone else (after a challenge) must be a legal one.
  return analysis.violations.length === 0 || !(blocksViolations(state) || state.forcedBy);
}
