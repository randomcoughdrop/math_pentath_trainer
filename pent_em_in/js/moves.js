// Generates legal moves, and rule-breaking-but-possible moves.
// So far this covers placements; Phase 4 adds movement moves.

import { COLS, ROWS } from "./constants.js";
import { getShapeCells } from "./pieces.js";
import { orientations, slideCells, externalCorners, SIDES } from "./transforms.js";
import { analyzePlacement, analyzeMove } from "./analyze.js";
import { isOnBoard, DIRECTIONS, CHIP_DIRECTIONS } from "./rules.js";

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

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

const LONGEST_RUN = Math.max(COLS, ROWS) - 1;

// Every move the current player could physically make, with its analysis:
// [{ move, analysis }]. Rule-breaking moves are included (Medium and Hard let
// players make them); impossible ones (off the board, onto a chip or piece) never are.
export function getPossibleMoves(state) {
  const player = state.currentPlayer;
  const found = [];

  function consider(move) {
    const analysis = analyzeMove(state, move);
    if (analysis.possible) found.push({ move, analysis });
  }

  for (const piece of state.pieces) {
    if (piece.owner !== player) continue;

    for (const direction of Object.keys(DIRECTIONS)) {
      for (let distance = 1; distance <= LONGEST_RUN; distance++) {
        consider({ type: "slide", pieceId: piece.id, direction, distance });
      }
    }
    for (const pivot of externalCorners(piece.cells)) {
      for (const quarterTurns of [1, 2, 3]) {
        consider({ type: "rotate", pieceId: piece.id, pivot, quarterTurns });
      }
    }
    for (const side of SIDES) {
      consider({ type: "flip", pieceId: piece.id, side });
    }
  }

  for (const chip of state.chips) {
    if (chip.owner !== player) continue;

    for (const [stepRow, stepCol] of CHIP_DIRECTIONS) {
      for (let distance = 1; distance <= LONGEST_RUN; distance++) {
        const row = chip.row + stepRow * distance;
        const col = chip.col + stepCol * distance;
        if (!isOnBoard(row, col)) break;
        consider({ type: "chip", chipId: chip.id, to: { row, col } });
      }
    }
  }

  return found;
}

// Every move that breaks no rule, as plain move objects.
export function getLegalMoves(state) {
  return getPossibleMoves(state)
    .filter(({ analysis }) => analysis.legal)
    .map(({ move }) => move);
}

// Is this piece "entrapped": does it have no legal slide, rotate, or flip?
export function isEntrapped(state, pieceId) {
  return !getLegalMoves(state).some((move) => move.pieceId === pieceId);
}
