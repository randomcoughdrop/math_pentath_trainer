// Entry point: wires everything together.

import { COLOR_SCHEMES } from "./constants.js";
import { createInitialState } from "./state.js";
import { render, renderTray } from "./renderer.js";
import { addDemoPieces } from "./demo.js";

const board = document.getElementById("board");
const trays = { 1: document.getElementById("tray-1"), 2: document.getElementById("tray-2") };
const status = document.getElementById("status");

// Handy for checking things by eye: add ?colors=yellow-green or ?demo=pieces to the address.
const params = new URLSearchParams(window.location.search);
const colorScheme = params.get("colors") === "yellow-green" ? "yellow-green" : "red-blue";

const state = createInitialState({ colorScheme });
if (params.get("demo") === "pieces") addDemoPieces(state);

// Label each tray with its player's color.
const colors = COLOR_SCHEMES[colorScheme];
for (const player of [1, 2]) {
  document.getElementById("tray-title-" + player).textContent =
    "Player " + player + " (" + colors[player].name + ")";
}

function draw() {
  render(board, state);
  renderTray(trays[1], state, 1);
  renderTray(trays[2], state, 2);
}

draw();

// Redraw whenever any canvas changes size.
const observer = new ResizeObserver(draw);
for (const canvas of [board, trays[1], trays[2]]) observer.observe(canvas);

status.textContent =
  "Phase 2: pieces and the piece trays are drawn. Add ?demo=pieces to the address to see sample pieces. Placing pieces arrives in Phase 3.";
console.log("Pent 'Em In loaded");
