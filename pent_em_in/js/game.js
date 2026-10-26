// Turn flow, phases, and win detection. So far this covers the placement phase.

import { PIECES_PER_PLAYER } from "./constants.js";
import { getShapeCells } from "./pieces.js";
import { orientations, shapeKey } from "./transforms.js";
import { analyzePlacement, isAllowed } from "./analyze.js";
import { copyState, otherPlayer } from "./state.js";
import { hasLegalPlacement } from "./moves.js";

// Play a move for the current player. Never changes the state it is given.
// Returns { ok: true, state } with the new state, or { ok: false, message }.
export function applyMove(state, move) {
  if (state.phase === "placement" && move.type === "place") {
    return applyPlacement(state, move);
  }
  return { ok: false, message: "That isn't possible right now." };
}

function applyPlacement(state, move) {
  const player = state.currentPlayer;

  if (!state.unusedShapes[player].includes(move.shape)) {
    return { ok: false, message: "That piece has already been placed." };
  }

  // The squares must really be that shape, in some turned or flipped position.
  const known = orientations(getShapeCells(move.shape)).map((cells) => shapeKey(cells));
  if (!known.includes(shapeKey(move.cells))) {
    return { ok: false, message: "Those squares don't make that shape." };
  }

  const analysis = analyzePlacement(state, player, move.cells);
  if (!isAllowed(state, analysis)) {
    return { ok: false, message: analysis.message };
  }

  const next = copyState(state);
  const cells = move.cells.map(([row, col]) => [row, col]);

  next.pieces.push({ id: next.nextPieceId, owner: player, shape: move.shape, cells });
  next.nextPieceId += 1;
  next.unusedShapes[player] = next.unusedShapes[player].filter((name) => name !== move.shape);
  next.placedCount[player] += 1;
  next.moveLog.push({ type: "place", player, shape: move.shape, cells });
  next.lastTurn = { player, move: { type: "place", shape: move.shape, cells }, violations: analysis.violations };

  startNextTurn(next, player);
  return { ok: true, state: next };
}

// Hand the turn to the other player, then check what that means: placement
// may be over, or the next player may be unable to place anything.
function startNextTurn(state, playerWhoJustMoved) {
  state.currentPlayer = otherPlayer(playerWhoJustMoved);

  const done = state.placedCount[1] === PIECES_PER_PLAYER && state.placedCount[2] === PIECES_PER_PLAYER;
  if (done) {
    state.phase = "movement";
    return;
  }

  // A player who cannot place a piece without breaking a rule forfeits.
  if (!hasLegalPlacement(state, state.currentPlayer)) {
    state.phase = "gameover";
    state.winner = otherPlayer(state.currentPlayer);
    state.winReason = "placement";
  }
}
