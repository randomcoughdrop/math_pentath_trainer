// Entry point: wires everything together.

import { createInitialState } from "./state.js";
import { render } from "./renderer.js";

const canvas = document.getElementById("board");
const status = document.getElementById("status");

// Handy for checking both color sets: add ?colors=yellow-green to the address.
const params = new URLSearchParams(window.location.search);
const colorScheme = params.get("colors") === "yellow-green" ? "yellow-green" : "red-blue";

const state = createInitialState({ colorScheme });

function draw() {
  render(canvas, state);
}

draw();
new ResizeObserver(draw).observe(canvas); // redraw whenever the canvas changes size

status.textContent = "Phase 1: the board is drawn. Placing pieces arrives in Phase 3.";
console.log("Pent 'Em In loaded");
