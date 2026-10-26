// Status text, buttons, and menus (the page, not the canvas).

import { COLOR_SCHEMES, PIECES_PER_PLAYER } from "./constants.js";
import { otherPlayer } from "./state.js";

// "Player 1 (Red)"
export function playerLabel(state, player) {
  return "Player " + player + " (" + COLOR_SCHEMES[state.settings.colorScheme][player].name + ")";
}

// The sentence shown above the board. Pure: it only builds text.
//   view    - { held, hover, notice, announce } (see input.js)
//   preview - the ghost, or null (see computePreview in input.js)
export function statusMessage(state, view, preview) {
  if (state.phase === "gameover") {
    if (state.winReason === "placement") {
      return (
        playerLabel(state, otherPlayer(state.winner)) + " can't place any piece, so " +
        playerLabel(state, state.winner) + " wins!"
      );
    }
    return "Game over.";
  }

  if (state.phase === "movement") {
    return "Placement is complete! Moving pieces arrives in Phase 4.";
  }

  const player = state.currentPlayer;
  const who = playerLabel(state, player);
  let message;

  if (!view.held) {
    const number = state.placedCount[player] + 1;
    message = who + ": choose a piece from your tray (piece " + number + " of " + PIECES_PER_PLAYER + ").";
  } else if (preview && !preview.ok) {
    message = who + ": " + preview.message;
  } else if (preview) {
    message = who + ": click to place the " + view.held.shape + " here (on a touch screen, tap the same square again or press Place).";
  } else {
    message = who + ": move over the board to place the " + view.held.shape + ". R rotates, F flips, Esc cancels.";
  }

  if (view.notice && !preview) message = view.notice + " " + message;

  // On the very first turn, say who won the random draw.
  if (state.moveLog.length === 0 && !view.held && view.announce) {
    message = view.announce + " " + message;
  }

  return message;
}

// Turn buttons on or off, and highlight whose tray it is to use.
//   buttons   - { rotateLeft, rotateRight, flip, place, cancel }
//   trayBoxes - { 1: element, 2: element } the containers around each tray
export function updateControls(state, view, preview, buttons, trayBoxes) {
  const placing = state.phase === "placement";
  const holding = placing && Boolean(view.held);

  buttons.rotateLeft.disabled = !holding;
  buttons.rotateRight.disabled = !holding;
  buttons.flip.disabled = !holding;
  buttons.cancel.disabled = !holding;
  buttons.place.disabled = !(preview && preview.ok);

  for (const player of [1, 2]) {
    trayBoxes[player].classList.toggle("active", placing && state.currentPlayer === player);
  }
}
