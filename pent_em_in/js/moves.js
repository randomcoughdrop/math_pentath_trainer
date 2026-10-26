// Generates legal moves, and rule-breaking-but-possible moves.
// So far this covers placements; Phase 4 adds movement moves.

import { COLS, ROWS } from "./constants.js";
import { getShapeCells } from "./pieces.js";
import { orientations, slideCells } from "./transforms.js";
import { analyzePlacement } from "./analyze.js";

// Every way to lay one of the player's unused shapes fully on the board,
// whether or not the rules allow it. Each is { shape, cells }.
function candidatePlacements(state, player) {
  const candidates = [];

  for (const shape of state.unusedShapes[player]) {
    for (const oriented of orientations(getShapeCells(shape))) {
      const height = Math.max(...oriented.map(([row]) => row)) + 1;
      const width = Math.max(...oriented.map(([, col]) => col)) + 1;

      for (let top = 0; top + height <= ROWS; top++) {
        for (let left = 0; left + width <= COLS; left++) {
          candidates.push({ shape, cells: slideCells(oriented, top, left) });
        }
      }
    }
  }

  return candidates;
}

// Every placement that breaks no rule.
export function getLegalPlacements(state, player) {
  return candidatePlacements(state, player)
    .filter((placement) => analyzePlacement(state, player, placement.cells).legal);
}

// Can the player place at least one more piece without breaking a rule?
export function hasLegalPlacement(state, player) {
  return candidatePlacements(state, player)
    .some((placement) => analyzePlacement(state, player, placement.cells).legal);
}
