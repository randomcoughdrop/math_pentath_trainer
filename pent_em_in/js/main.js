// Entry point: wires everything together.

import { createInitialState } from "./state.js";
import { applyMove } from "./game.js";
import { render, renderTray } from "./renderer.js";
import { setupInput, computePreview } from "./input.js";
import { playerLabel, statusMessage, updateControls } from "./ui.js";

// --- the page's elements ---

const board = document.getElementById("board");
const trays = { 1: document.getElementById("tray-1"), 2: document.getElementById("tray-2") };
const trayBoxes = { 1: document.getElementById("tray-box-1"), 2: document.getElementById("tray-box-2") };
const status = document.getElementById("status");
const buttons = {
  rotateLeft: document.getElementById("btn-rotate-left"),
  rotateRight: document.getElementById("btn-rotate-right"),
  flip: document.getElementById("btn-flip"),
  place: document.getElementById("btn-place"),
  cancel: document.getElementById("btn-cancel"),
};

// --- starting the game ---

// Handy for checking things: add ?colors=yellow-green or ?first=2 to the address.
const params = new URLSearchParams(window.location.search);
const colorScheme = params.get("colors") === "yellow-green" ? "yellow-green" : "red-blue";
const startingPlayer = ["1", "2"].includes(params.get("first"))
  ? Number(params.get("first"))
  : (Math.random() < 0.5 ? 1 : 2); // the digital version of the Game Monitor's hidden-chip draw

let state = createInitialState({ colorScheme, startingPlayer });

// Things that are not part of the game itself: the piece being held, where the
// cursor is, and short messages.
const view = { held: null, hover: null, notice: "", announce: "" };
view.announce = "Random draw: " + playerLabel(state, startingPlayer) + " goes first.";

for (const player of [1, 2]) {
  document.getElementById("tray-title-" + player).textContent = playerLabel(state, player);
}

// --- drawing ---

function draw() {
  const preview = computePreview(state, view.held, view.hover);

  render(board, state, preview);
  for (const player of [1, 2]) {
    // Only the player whose turn it is can hold a piece.
    renderTray(trays[player], state, player, state.currentPlayer === player ? view.held : null);
  }

  status.textContent = statusMessage(state, view, preview);
  updateControls(state, view, preview, buttons, trayBoxes);
}

// --- playing ---

// Called by the input code when the player tries to place the piece they hold.
function handlePlace(move) {
  const result = applyMove(state, move);
  if (result.ok) {
    state = result.state;
    view.held = null;
    view.hover = null;
  }
  return result;
}

setupInput({ board, trays, buttons, view, getState: () => state, onPlace: handlePlace, onChange: draw });

draw();

// Redraw whenever any canvas changes size.
const observer = new ResizeObserver(draw);
for (const canvas of [board, trays[1], trays[2]]) observer.observe(canvas);

console.log("Pent 'Em In loaded");
