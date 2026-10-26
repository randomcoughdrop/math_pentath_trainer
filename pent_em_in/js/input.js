// Turns mouse, touch, and keyboard input into game actions.
//
// The piece a player is holding, and where the cursor is, are temporary and
// are not part of the game, so they live in a small "view" object that the
// page owns:  { held, hover, notice, announce }
//   held   - { shape, cells } the shape picked from the tray, in its current orientation
//   hover  - { row, col } the board square the cursor (or last tap) is on
//   notice - a short message to show, such as why a click didn't work

import { SHAPE_NAMES, getShapeCells } from "./pieces.js";
import { rotateAboutVertex, flipOverSide, normalize, slideCells } from "./transforms.js";
import { analyzeMove, isAllowed } from "./analyze.js";
import { boardCellFromPoint, trayIndexFromPoint } from "./renderer.js";

// ---------------------------------------------------------------------------
// The held piece (pure helpers: no page needed, so they are easy to test)
// ---------------------------------------------------------------------------

// Pick up a shape in its starting orientation.
export function newHeldPiece(shape) {
  return { shape, cells: normalize(getShapeCells(shape)) };
}

// Turn the held piece a quarter turn. Rotating and flipping together can reach
// all 8 orientations of any shape.
export function rotateHeld(held, clockwise = true) {
  const turned = rotateAboutVertex(held.cells, [0, 0], clockwise ? 1 : 3);
  return { shape: held.shape, cells: normalize(turned) };
}

// Mirror the held piece left to right.
export function flipHeld(held) {
  return { shape: held.shape, cells: normalize(flipOverSide(held.cells, "left")) };
}

// Where the held piece lands on the board when the cursor is on square (row, col).
// The piece is held by its middle, so it stays under the cursor as it turns.
export function cellsAt(held, row, col) {
  const height = Math.max(...held.cells.map(([r]) => r)) + 1;
  const width = Math.max(...held.cells.map(([, c]) => c)) + 1;
  const top = row - Math.floor((height - 1) / 2);
  const left = col - Math.floor((width - 1) / 2);
  return slideCells(held.cells, top, left);
}

// What the ghost should show: { cells, ok, message }, or null if nothing is held
// or the cursor isn't on the board. "ok" means the piece may be placed there.
export function computePreview(state, held, hover) {
  if (state.phase !== "placement" || !held || !hover) return null;

  const cells = cellsAt(held, hover.row, hover.col);
  const analysis = analyzeMove(state, { type: "place", shape: held.shape, cells });
  return { cells, ok: isAllowed(state, analysis), message: analysis.message };
}

// ---------------------------------------------------------------------------
// Wiring to the page
// ---------------------------------------------------------------------------

// Connect the board, trays, buttons, and keyboard.
//   board, trays    - the canvas elements (trays is { 1: canvas, 2: canvas })
//   buttons         - { rotateLeft, rotateRight, flip, place, cancel }
//   view            - the temporary state described at the top of this file
//   getState        - returns the current game state
//   onPlace(move)   - tries to play a placement; returns { ok, message }
//   onChange()      - called after anything that needs a redraw
export function setupInput({ board, trays, buttons, view, getState, onPlace, onChange }) {
  function isPlacing() {
    return getState().phase === "placement";
  }

  // --- actions ---

  function rotate(clockwise) {
    if (!isPlacing() || !view.held) return;
    view.held = rotateHeld(view.held, clockwise);
    view.notice = "";
    onChange();
  }

  function flip() {
    if (!isPlacing() || !view.held) return;
    view.held = flipHeld(view.held);
    view.notice = "";
    onChange();
  }

  function cancel() {
    if (!view.held) return;
    view.held = null;
    view.notice = "";
    onChange();
  }

  function tryPlace() {
    if (!isPlacing() || !view.held || !view.hover) return;
    const move = {
      type: "place",
      shape: view.held.shape,
      cells: cellsAt(view.held, view.hover.row, view.hover.col),
    };
    const result = onPlace(move);
    view.notice = result.ok ? "" : result.message;
    onChange();
  }

  // --- the board ---

  function squareUnderPointer(event) {
    const rect = board.getBoundingClientRect();
    return boardCellFromPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width);
  }

  // A mouse hovers, so the ghost follows it. A finger doesn't hover; it taps.
  board.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    view.hover = squareUnderPointer(event);
    onChange();
  });

  board.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return; // a lifted finger also "leaves"
    view.hover = null;
    onChange();
  });

  board.addEventListener("pointerup", (event) => {
    if (!isPlacing() || !view.held) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const square = squareUnderPointer(event);
    if (!square) return;

    if (event.pointerType === "mouse") {
      view.hover = square;
      tryPlace();
      return;
    }

    // Touch: the first tap moves the ghost there; tapping the same square again places.
    const sameSquare = view.hover && view.hover.row === square.row && view.hover.col === square.col;
    if (sameSquare) {
      tryPlace();
    } else {
      view.hover = square;
      view.notice = "";
      onChange();
    }
  });

  // --- the trays ---

  for (const player of [1, 2]) {
    trays[player].addEventListener("pointerup", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const state = getState();
      if (state.phase !== "placement" || state.currentPlayer !== player) return;

      const rect = trays[player].getBoundingClientRect();
      const index = trayIndexFromPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width);
      if (index === null) return;

      const shape = SHAPE_NAMES[index];
      if (!state.unusedShapes[player].includes(shape)) {
        view.notice = "That piece is already on the board.";
      } else if (view.held && view.held.shape === shape) {
        view.held = null; // clicking the held piece again puts it back
        view.notice = "";
      } else {
        view.held = newHeldPiece(shape);
        view.notice = "";
      }
      onChange();
    });
  }

  // --- buttons and keyboard ---

  buttons.rotateLeft.addEventListener("click", () => rotate(false));
  buttons.rotateRight.addEventListener("click", () => rotate(true));
  buttons.flip.addEventListener("click", flip);
  buttons.place.addEventListener("click", tryPlace);
  buttons.cancel.addEventListener("click", cancel);

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "r") rotate(!event.shiftKey); // Shift+R turns the other way
    else if (key === "f") flip();
    else if (key === "escape") cancel();
  });
}
