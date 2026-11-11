// Entry point: wires everything together.

import { createInitialState } from "./state.js";
import { applyMove } from "./game.js";
import { render, renderTray } from "./renderer.js";
import { setupInput, computePreview, buildOverlay, clearSelection, legalMovesFor } from "./input.js";
import { playerLabel, statusMessage, updateControls, renderLog } from "./ui.js";

// --- the page's elements ---

const board = document.getElementById("board");
const trays = { 1: document.getElementById("tray-1"), 2: document.getElementById("tray-2") };
const trayBoxes = { 1: document.getElementById("tray-box-1"), 2: document.getElementById("tray-box-2") };
const status = document.getElementById("status");
const moveLog = document.getElementById("move-log");
const buttons = {
  // placement
  rotateLeft: document.getElementById("btn-rotate-left"),
  rotateRight: document.getElementById("btn-rotate-right"),
  flip: document.getElementById("btn-flip"),
  place: document.getElementById("btn-place"),
  cancel: document.getElementById("btn-cancel"),
  // movement
  slideAction: document.getElementById("btn-slide"),
  rotateAction: document.getElementById("btn-rotate"),
  flipAction: document.getElementById("btn-flip-piece"),
  turn90: document.getElementById("btn-turn-90"),
  turn180: document.getElementById("btn-turn-180"),
  turn270: document.getElementById("btn-turn-270"),
  moveCancel: document.getElementById("btn-move-cancel"),
};
// The groups of controls that show in each phase.
const panels = {
  placement: document.getElementById("placement-controls"),
  movement: document.getElementById("movement-controls"),
  trays: document.getElementById("trays"),
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
const view = { held: null, hover: null, notice: "", announce: "", selected: null, action: "slide", pivot: null, turnPreview: null };
view.announce = "Random draw: " + playerLabel(state, startingPlayer) + " goes first.";

for (const player of [1, 2]) {
  document.getElementById("tray-title-" + player).textContent = playerLabel(state, player);
}

// --- drawing ---

function draw() {
  const preview = computePreview(state, view.held, view.hover);
  const legal = legalMovesFor(state);

  render(board, state, { preview, ...buildOverlay(state, view, legal) });
  for (const player of [1, 2]) {
    // Only the player whose turn it is can hold a piece.
    renderTray(trays[player], state, player, state.currentPlayer === player ? view.held : null);
  }

  status.textContent = statusMessage(state, view, preview, legal);
  updateControls(state, view, preview, legal, buttons, panels, trayBoxes);

  // Only rebuild the log when it has changed.
  if (moveLog.childElementCount !== state.moveLog.length) renderLog(moveLog, state);
}

// --- playing ---

// Called by the input code when a player tries to make a move.
function handleMove(move) {
  const result = applyMove(state, move);
  if (result.ok) {
    state = result.state;
    view.held = null;
    view.hover = null;
    clearSelection(view);
  }
  return result;
}

setupInput({ board, trays, buttons, view, getState: () => state, onMove: handleMove, onChange: draw });

draw();

// Redraw whenever any canvas changes size.
const observer = new ResizeObserver(draw);
for (const canvas of [board, trays[1], trays[2]]) observer.observe(canvas);

console.log("Pent 'Em In loaded");
