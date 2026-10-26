// analyzeMove(): is a move possible, and which rules does it break?
//
// "Possible" means the move physically works: every square is on the board and
// none lands on a chip or another piece. That is never allowed to fail.
//
// "Violations" are rules the move breaks even though it is possible. Easy
// refuses these; Medium and Hard let them through to be challenged (Phase 6).

import {
  isOnBoard, isStar, occupiedSquares, squareKey, touchesOpponentPiece, blocksViolations,
} from "./rules.js";

// Plain-English reasons, shown in the status line.
export const MESSAGES = {
  offBoard: "That doesn't fit on the board.",
  overlap: "That overlaps a chip or another piece.",
  "placement-star": "A piece can't be placed on a star.",
  "placement-contact": "A piece can't touch the other player's piece along an edge.",
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

// Analyze any move for the player whose turn it is. Only placements exist so far.
export function analyzeMove(state, move) {
  if (move.type === "place") {
    return analyzePlacement(state, state.currentPlayer, move.cells);
  }
  throw new Error("analyzeMove: '" + move.type + "' moves arrive in Phase 4");
}

// May this move actually be played? Impossible moves never can. Rule-breaking
// moves can only if the current difficulty lets them through.
export function isAllowed(state, analysis) {
  if (!analysis.possible) return false;
  return analysis.violations.length === 0 || !blocksViolations(state);
}
