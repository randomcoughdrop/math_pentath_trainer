// Checks made whenever a player is about to take a turn: can they do anything
// at all? Used by game.js and challenges.js.

import { otherPlayer } from "./state.js";
import { hasLegalPlacement, getLegalMoves } from "./moves.js";

// During placement: a player who cannot place a piece without breaking a rule
// forfeits.
export function checkPlacementForfeit(state) {
  if (state.phase !== "placement") return;

  if (!hasLegalPlacement(state, state.currentPlayer)) {
    state.phase = "gameover";
    state.winner = otherPlayer(state.currentPlayer);
    state.winReason = "placement";
  }
}

// During movement: the player about to move loses if all of their pieces are
// entrapped (no piece has a legal move). That also covers having no legal move
// at all, since a legal move is a move of one of their pieces or chips, and
// the rules count a player who can only shuffle chips as entrapped.
export function checkEntrapment(state) {
  if (state.phase !== "movement") return;

  const player = state.currentPlayer;
  const legal = getLegalMoves(state);

  const mine = state.pieces.filter((piece) => piece.owner === player);
  const allTrapped = mine.every((piece) => !legal.some((move) => move.pieceId === piece.id));

  if (allTrapped) {
    state.phase = "gameover";
    state.winner = otherPlayer(player);
    state.winReason = "entrapment";
  }
}

// Both checks: whichever applies to the current phase.
export function checkStuckPlayer(state) {
  checkPlacementForfeit(state);
  checkEntrapment(state);
}
