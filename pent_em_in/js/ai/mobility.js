// A fast way to list the legal moves of one player, for the CPU to look at many
// positions quickly. It gives exactly the same moves as getLegalMoves in
// moves.js (a test checks this), but it stops looking along a line as soon as
// something is in the way instead of analyzing every distance.

import { DIRECTIONS, CHIP_DIRECTIONS, isOnBoard, isStar, occupiedSquares, squareKey, cellsAfterMove } from "../rules.js";
import { externalCorners, SIDES } from "../transforms.js";
import { slideCells } from "../transforms.js";

// A move is legal here when every square it lands on is on the board, empty,
// and not a star.
function landsClear(cells, taken) {
  for (const [row, col] of cells) {
    if (!isOnBoard(row, col) || isStar(row, col) || taken.has(squareKey(row, col))) return false;
  }
  return true;
}

// Calls visit(move) for each legal move of `player` in this position. Pieces
// only if piecesOnly is true (when a pentomino move is required).
export function forEachLegalMove(state, player, visit, piecesOnly = false) {
  const streak = state.repeat[player];

  for (const piece of state.pieces) {
    if (piece.owner !== player) continue;
    // The same piece can't move a third turn in a row.
    if (streak.pieceId === piece.id && streak.count >= 2) continue;

    const taken = occupiedSquares(state, { pieceId: piece.id });

    for (const direction of Object.keys(DIRECTIONS)) {
      const [stepRow, stepCol] = DIRECTIONS[direction];
      for (let distance = 1; ; distance++) {
        const cells = slideCells(piece.cells, stepRow * distance, stepCol * distance);
        // Anything in the way here also blocks every longer slide.
        if (!landsClear(cells, taken)) break;
        visit({ type: "slide", pieceId: piece.id, direction, distance });
      }
    }

    for (const pivot of externalCorners(piece.cells)) {
      for (const quarterTurns of [1, 2, 3]) {
        const move = { type: "rotate", pieceId: piece.id, pivot, quarterTurns };
        if (landsClear(cellsAfterMove(piece.cells, move), taken)) visit(move);
      }
    }

    for (const side of SIDES) {
      const move = { type: "flip", pieceId: piece.id, side };
      if (landsClear(cellsAfterMove(piece.cells, move), taken)) visit(move);
    }
  }

  if (piecesOnly || state.mustMovePiece || state.lastWasChipMove[player]) return;

  for (const chip of state.chips) {
    if (chip.owner !== player) continue;
    const taken = occupiedSquares(state, { chipId: chip.id });
    for (const [stepRow, stepCol] of CHIP_DIRECTIONS) {
      for (let distance = 1; ; distance++) {
        const row = chip.row + stepRow * distance;
        const col = chip.col + stepCol * distance;
        if (!landsClear([[row, col]], taken)) break;
        visit({ type: "chip", chipId: chip.id, to: { row, col } });
      }
    }
  }
}

export function fastLegalMoves(state, player, piecesOnly = false) {
  const moves = [];
  forEachLegalMove(state, player, (move) => moves.push(move), piecesOnly);
  return moves;
}

// How many legal moves each of the player's pieces has, and how many their
// chips have. { perPiece: Map(pieceId -> count), pieceTotal, chipTotal }
export function mobility(state, player) {
  const perPiece = new Map();
  for (const piece of state.pieces) if (piece.owner === player) perPiece.set(piece.id, 0);
  let pieceTotal = 0;
  let chipTotal = 0;
  forEachLegalMove(state, player, (move) => {
    if (move.type === "chip") {
      chipTotal++;
    } else {
      perPiece.set(move.pieceId, perPiece.get(move.pieceId) + 1);
      pieceTotal++;
    }
  });
  return { perPiece, pieceTotal, chipTotal };
}

// The position after a move, built cheaply (no history, no log, nothing
// checked) so the CPU can look at it. It shares everything it doesn't change
// with `state`, so it must be treated as read-only. Placements are not handled here.
export function afterMove(state, move) {
  const player = state.currentPlayer;
  const next = {
    ...state,
    currentPlayer: player === 1 ? 2 : 1,
    mustMovePiece: false,
    repeat: { ...state.repeat },
    lastWasChipMove: { ...state.lastWasChipMove },
  };

  if (move.type === "chip") {
    next.chips = state.chips.map((chip) =>
      chip.id === move.chipId ? { ...chip, row: move.to.row, col: move.to.col } : chip);
    next.lastWasChipMove[player] = true;
  } else {
    next.pieces = state.pieces.map((piece) =>
      piece.id === move.pieceId ? { ...piece, cells: cellsAfterMove(piece.cells, move) } : piece);
    const streak = state.repeat[player];
    next.repeat[player] = streak.pieceId === move.pieceId
      ? { pieceId: move.pieceId, count: streak.count + 1 }
      : { pieceId: move.pieceId, count: 1 };
    next.lastWasChipMove[player] = false;
  }
  return next;
}
