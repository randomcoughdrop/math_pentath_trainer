// Turns mouse, touch, and keyboard input into game actions.
//
// What a player is in the middle of (the piece they hold, the piece they have
// selected, where the cursor is) is temporary and is not part of the game, so
// it lives in a small "view" object that the page owns:
//   held      - placement: { shape, cells } the shape picked from the tray
//   hover     - { row, col } the board square the cursor (or last tap) is on
//   notice    - a short message to show, such as why a click didn't work
//   announce  - a one-time message for the first turn
//   selected  - movement: { kind: "piece", id, anchor: [row, col] } or { kind: "chip", id }
//   action    - movement: "slide", "rotate", or "flip" for the selected piece
//   pivot     - movement: the corner chosen to rotate around, [row, col]
//   turnPreview - movement: 1, 2, or 3, while the pointer is over a turn button
//   paused    - the game is paused (the board is hidden)
//   challengeOpen - the list of challenge rules is showing
//
// Everything that decides things is a plain function (easy to test). Only
// setupInput touches the page.

import { ROWS, COLS, bandForLevel } from "./constants.js";
import { SHAPE_NAMES, getShapeCells } from "./pieces.js";
import { rotateAboutVertex, flipOverSide, normalize, slideCells } from "./transforms.js";
import { analyzePlacement, isAllowed } from "./analyze.js";
import { getAllowedMoves } from "./moves.js";
import { DIRECTIONS, cellsAfterMove, blocksViolations } from "./rules.js";
import { cpuToAct } from "./players.js";
import { boardCellFromPoint, trayIndexFromPoint, vertexFromPoint } from "./renderer.js";

// ---------------------------------------------------------------------------
// Placement: the held piece
// ---------------------------------------------------------------------------

// Pick up a shape in its starting orientation.
// (Or, with `cells`, a piece in the orientation it already has.)
export function newHeldPiece(shape, cells = null) {
  return { shape, cells: normalize(cells ?? getShapeCells(shape)) };
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

// Is someone placing a piece right now? That is the placement phase, or the
// step after a correct challenge on a placement (when the challenger places a
// piece for the opponent).
export function isPlacingNow(state) {
  return state.phase === "placement" && (!state.pending || state.pending.kind === "place-for");
}

// Whose piece is being placed: normally the player to move, but after a
// correct placement challenge it is the opponent's piece.
export function placementOwner(state) {
  return state.pending && state.pending.kind === "place-for" ? state.pending.offender : state.currentPlayer;
}

// What the ghost should show: { cells, ok, message, owner }, or null if nothing
// is held or the cursor isn't on the board. "ok" means the piece may be placed
// there. (A piece placed for the opponent after a challenge must be legal, even
// on Medium and Hard.)
export function computePreview(state, held, hover) {
  if (!isPlacingNow(state) || !held || !hover) return null;

  const owner = placementOwner(state);
  const cells = cellsAt(held, hover.row, hover.col);
  const analysis = analyzePlacement(state, owner, cells);
  const ok = state.pending ? analysis.legal : isAllowed(state, analysis);
  return { cells, ok, message: analysis.message, owner };
}

// ---------------------------------------------------------------------------
// Movement: what can be clicked
// ---------------------------------------------------------------------------

// The moves the current player may make, worked out once per state. On Easy
// these are only the legal moves; on Medium and Hard they include moves that
// break a rule (which the opponent can challenge).
let cache = { state: null, moves: [] };
export function playableMovesFor(state) {
  if (cache.state !== state) {
    const moving = state.phase === "movement" && !state.pending;
    cache = { state, moves: moving ? getAllowedMoves(state) : [] };
  }
  return cache.moves;
}

// On Hard the player gets no help with slides, turns, and flips: no marked
// destinations or corners. They pick a piece up, move and turn a see-through
// copy wherever they like, and drop it. The game then works out which single
// action (if any) that was.
export function usesFreeMoves(state) {
  return state.phase === "movement" && !state.pending && bandForLevel(state.settings.level) === "hard";
}

// Which move of this piece, if any, ends with it on exactly these squares?
export function resolveFreeMove(legal, piece, targetCells) {
  const wanted = targetCells.map(([row, col]) => squareKey(row, col)).sort().join(";");
  return movesForPiece(legal, piece.id).find((move) =>
    cellsAfterMove(piece.cells, move).map(([row, col]) => squareKey(row, col)).sort().join(";") === wanted) ?? null;
}

// The ghost for a piece being moved freely: { cells, ok, owner }, or null.
// "ok" only means the piece can get there with one slide, turn, or flip.
export function computeFreePreview(state, view, legal) {
  if (!usesFreeMoves(state) || !view.free || !view.hover || !view.selected || view.selected.kind !== "piece") return null;
  const piece = state.pieces.find((candidate) => candidate.id === view.selected.id);
  if (!piece) return null;
  const cells = cellsAt(view.free, view.hover.row, view.hover.col);
  return { cells, ok: resolveFreeMove(legal, piece, cells) !== null, owner: piece.owner };
}

const sameSquare = (a, b) => a[0] === b[0] && a[1] === b[1];
const squareKey = (row, col) => row + "," + col;

export function movesForPiece(legal, pieceId) {
  return legal.filter((move) => move.pieceId === pieceId);
}

// Squares the clicked square of a piece could slide to, as a Map of
// "row,col" -> move. (The piece moves as a whole: where the square you picked
// it up by would land.)
export function slideTargets(legal, piece, anchor) {
  const targets = new Map();
  for (const move of movesForPiece(legal, piece.id)) {
    if (move.type !== "slide") continue;
    const [stepRow, stepCol] = DIRECTIONS[move.direction];
    targets.set(squareKey(anchor[0] + stepRow * move.distance, anchor[1] + stepCol * move.distance), move);
  }
  return targets;
}

// Corners of the piece where at least one rotation is legal.
export function rotateCorners(legal, pieceId) {
  const corners = [];
  for (const move of movesForPiece(legal, pieceId)) {
    if (move.type === "rotate" && !corners.some((corner) => sameSquare(corner, move.pivot))) {
      corners.push(move.pivot);
    }
  }
  return corners;
}

// Which quarter turns (1, 2, 3) are legal around a corner.
export function rotateTurns(legal, pieceId, pivot) {
  return movesForPiece(legal, pieceId)
    .filter((move) => move.type === "rotate" && sameSquare(move.pivot, pivot))
    .map((move) => move.quarterTurns);
}

// The legal flips, each with the squares the piece would land on.
export function flipChoices(legal, piece) {
  return movesForPiece(legal, piece.id)
    .filter((move) => move.type === "flip")
    .map((move) => ({ move, cells: cellsAfterMove(piece.cells, move) }));
}

// Squares the chip could move to, as a Map of "row,col" -> move.
export function chipTargets(legal, chipId) {
  const targets = new Map();
  for (const move of legal) {
    if (move.type === "chip" && move.chipId === chipId) {
      targets.set(squareKey(move.to.row, move.to.col), move);
    }
  }
  return targets;
}

// Extra things for the renderer to draw on top of the board while a piece or
// chip is selected: { selectedPieceId, selectedChipId, destinations, corners, pivot, ghosts }.
// Easy-only help in the movement phase: which of the player's pieces have no
// legal move at all. Returns null on Medium and Hard (and outside movement).
export function easyHelpFor(state, legal) {
  if (!blocksViolations(state) || state.phase !== "movement" || state.pending) return null;
  const stuckPieceIds = state.pieces
    .filter((piece) => piece.owner === state.currentPlayer && movesForPiece(legal, piece.id).length === 0)
    .map((piece) => piece.id);
  return { stuckPieceIds };
}

export function buildOverlay(state, view, legal) {
  const overlay = {};
  const easyHelp = easyHelpFor(state, legal);
  if (easyHelp && easyHelp.stuckPieceIds.length > 0) overlay.dimmedPieceIds = easyHelp.stuckPieceIds;
  const selected = view.selected;
  if (state.pending && state.pending.kind === "move-chip" && selected && selected.kind === "chip") {
    return { selectedChipId: selected.id };
  }
  if (state.phase !== "movement" || state.pending || !selected) return overlay;

  if (selected.kind === "chip") {
    overlay.selectedChipId = selected.id;
    overlay.destinations = [...chipTargets(legal, selected.id).values()].map((move) => [move.to.row, move.to.col]);
    return overlay;
  }

  const piece = state.pieces.find((candidate) => candidate.id === selected.id);
  if (!piece) return overlay;
  if (view.free && usesFreeMoves(state)) {
    overlay.faintPieceId = piece.id; // where it was; the moving copy is the ghost
    return overlay;
  }
  overlay.selectedPieceId = piece.id;

  if (view.action === "slide") {
    const targets = slideTargets(legal, piece, selected.anchor);
    overlay.destinations = [...targets.keys()].map((key) => key.split(",").map(Number));

    // Pointing at a destination shows where the piece would land.
    const over = view.hover && targets.get(squareKey(view.hover.row, view.hover.col));
    if (over) overlay.ghosts = [{ cells: cellsAfterMove(piece.cells, over) }];
  } else if (view.action === "rotate") {
    overlay.corners = rotateCorners(legal, piece.id);
    overlay.pivot = view.pivot;
    if (view.pivot && view.turnPreview) {
      const move = movesForPiece(legal, piece.id).find((candidate) =>
        candidate.type === "rotate" && candidate.quarterTurns === view.turnPreview && sameSquare(candidate.pivot, view.pivot));
      if (move) overlay.ghosts = [{ cells: cellsAfterMove(piece.cells, move) }];
    }
  } else if (view.action === "flip") {
    overlay.ghosts = flipChoices(legal, piece).map((choice) => ({ cells: choice.cells }));
  }

  return overlay;
}

// ---------------------------------------------------------------------------
// Movement: clicks
// ---------------------------------------------------------------------------

// Forget the current selection.
export function clearSelection(view) {
  view.selected = null;
  view.action = "slide";
  view.pivot = null;
  view.turnPreview = null;
  view.free = null;
}

// Switch what the selected piece will do: "slide", "rotate", or "flip".
export function chooseAction(view, action) {
  if (!view.selected || view.selected.kind !== "piece") return;
  view.action = action;
  view.pivot = null;
  view.turnPreview = null;
}

// A click on the board during movement. `cell` is the square clicked ({ row, col },
// or null) and `vertex` the grid corner nearest the click ([row, col], or null).
// Selects pieces and chips, picks pivots, and returns a move when the click
// completes one (the caller plays it); otherwise returns null.
export function movementClick(state, view, legal, cell, vertex) {
  view.notice = "";
  const selected = view.selected;

  if (selected && selected.kind === "piece") {
    const piece = state.pieces.find((candidate) => candidate.id === selected.id);
    if (view.free) return null; // moving freely: clicks are handled by the drop logic

    if (view.action === "rotate" && vertex && rotateCorners(legal, piece.id).some((corner) => sameSquare(corner, vertex))) {
      view.pivot = vertex;
      return null;
    }
    if (view.action === "flip" && cell) {
      const choice = flipChoices(legal, piece).find((candidate) =>
        candidate.cells.some(([row, col]) => row === cell.row && col === cell.col));
      if (choice) return choice.move;
    }
    if (view.action === "slide" && cell) {
      const move = slideTargets(legal, piece, selected.anchor).get(squareKey(cell.row, cell.col));
      if (move) return move;
    }
  }

  if (selected && selected.kind === "chip" && cell) {
    const move = chipTargets(legal, selected.id).get(squareKey(cell.row, cell.col));
    if (move) return move;
  }

  if (!cell) return null;

  // Otherwise the click picks something up.
  const piece = state.pieces.find((candidate) => candidate.cells.some(([row, col]) => row === cell.row && col === cell.col));
  if (piece) {
    if (piece.owner !== state.currentPlayer) {
      view.notice = "That isn't your piece.";
      return null;
    }
    const samePiece = selected && selected.kind === "piece" && selected.id === piece.id;
    if (!samePiece) {
      view.action = "slide";
      view.pivot = null;
      view.turnPreview = null;
    }
    view.selected = { kind: "piece", id: piece.id, anchor: [cell.row, cell.col] };
    view.free = usesFreeMoves(state) && movesForPiece(legal, piece.id).length > 0 ? newHeldPiece(piece.shape, piece.cells) : null;
    if (view.free) view.hover = null;
    if (movesForPiece(legal, piece.id).length === 0) view.notice = "That piece has no legal move right now.";
    return null;
  }

  const chip = state.chips.find((candidate) => candidate.row === cell.row && candidate.col === cell.col);
  if (chip) {
    if (chip.owner !== state.currentPlayer) {
      view.notice = "That isn't your chip.";
      return null;
    }
    clearSelection(view);
    view.selected = { kind: "chip", id: chip.id };
    if (chipTargets(legal, chip.id).size === 0) view.notice = "That chip has no legal move right now.";
  }

  return null;
}

// The move for a turn button (90, 180, or 270 degrees), if there is one.
export function turnMove(state, view, legal, quarterTurns) {
  if (!view.selected || view.selected.kind !== "piece" || !view.pivot) return null;
  return movesForPiece(legal, view.selected.id).find((move) =>
    move.type === "rotate" && move.quarterTurns === quarterTurns && sameSquare(move.pivot, view.pivot)) ?? null;
}

// After an incorrect challenge on a placement, the challenged player moves one
// of the challenger's chips: click the chip, then any empty square. Returns the
// move once there is one.
export function relocationClick(state, view, cell) {
  view.notice = "";
  if (!cell) return null;

  const chip = state.chips.find((candidate) => candidate.row === cell.row && candidate.col === cell.col);
  if (chip) {
    if (chip.owner !== state.pending.challenger) {
      view.notice = "Pick one of the other player's chips.";
      return null;
    }
    view.selected = { kind: "chip", id: chip.id };
    return null;
  }

  if (!view.selected || view.selected.kind !== "chip") {
    view.notice = "Click one of the other player's chips first.";
    return null;
  }
  return { type: "relocate-chip", chipId: view.selected.id, to: { row: cell.row, col: cell.col } };
}

// ---------------------------------------------------------------------------
// Wiring to the page
// ---------------------------------------------------------------------------

// Connect the board, trays, buttons, and keyboard.
//   board, trays    - the canvas elements (trays is { 1: canvas, 2: canvas })
//   buttons         - every button (see index.html)
//   view            - the temporary state described at the top of this file
//   getState        - returns the current game state
//   onMove(move)    - tries to play a move; returns { ok, message }
//   onChange()      - called after anything that needs a redraw
export function setupInput({ board, trays, buttons, view, getState, onMove, onChange }) {
  const placing = () => Boolean(getState()) && isPlacingNow(getState()) && !cpuToAct(getState());

  // Hard: a piece is being moved freely (see usesFreeMoves).
  const freeMoving = () => {
    const state = getState();
    return Boolean(state) && !cpuToAct(state) && usesFreeMoves(state)
      && Boolean(view.selected) && view.selected.kind === "piece" && Boolean(view.free);
  };

  // Drop the free piece where the ghost is, if that is one slide, turn, or flip.
  function commitFree() {
    if (!view.hover) return;
    const state = getState();
    const piece = state.pieces.find((candidate) => candidate.id === view.selected.id);
    const move = resolveFreeMove(playableMovesFor(state), piece, cellsAt(view.free, view.hover.row, view.hover.col));
    if (move) {
      play(move);
    } else {
      view.notice = "The piece can't get there with one slide, one turn about a corner, or one flip.";
      onChange();
    }
  }

  function play(move) {
    const result = onMove(move);
    view.notice = result.ok ? "" : result.message;
    onChange();
  }

  // --- placement actions ---

  function rotate(clockwise) {
    if (freeMoving()) view.free = rotateHeld(view.free, clockwise);
    else if (placing() && view.held) view.held = rotateHeld(view.held, clockwise);
    else return;
    view.notice = "";
    onChange();
  }

  function flip() {
    if (freeMoving()) view.free = flipHeld(view.free);
    else if (placing() && view.held) view.held = flipHeld(view.held);
    else return;
    view.notice = "";
    onChange();
  }

  function cancel() {
    if (placing() && view.held) {
      view.held = null;
    } else if (view.selected) {
      clearSelection(view);
    } else {
      return;
    }
    view.notice = "";
    onChange();
  }

  function tryPlace() {
    if (freeMoving()) return commitFree();
    if (!placing() || !view.held || !view.hover) return;
    play({
      type: "place",
      shape: view.held.shape,
      cells: cellsAt(view.held, view.hover.row, view.hover.col),
    });
  }

  // --- the board ---

  function pointOnBoard(event) {
    const rect = board.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width };
  }

  function squareUnderPointer(event) {
    const { x, y, width } = pointOnBoard(event);
    return boardCellFromPoint(x, y, width);
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
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const state = getState();
    if (!state || cpuToAct(state)) return; // the computer is acting

    if (state.pending && state.pending.kind === "move-chip") {
      const move = relocationClick(state, view, squareUnderPointer(event));
      if (move) play(move);
      else onChange();
      return;
    }
    if (state.pending && state.pending.kind === "choose") return;

    if (freeMoving()) {
      const square = squareUnderPointer(event);
      if (!square) return;
      const same = view.hover && view.hover.row === square.row && view.hover.col === square.col;
      if (event.pointerType === "mouse" || same) {
        view.hover = square;
        commitFree();
      } else {
        view.hover = square; // touch: the first tap moves the ghost, the second drops it
        view.notice = "";
        onChange();
      }
      return;
    }

    if (state.phase === "movement") {
      const { x, y, width } = pointOnBoard(event);
      const move = movementClick(state, view, playableMovesFor(state), boardCellFromPoint(x, y, width), vertexFromPoint(x, y, width));
      if (move) play(move);
      else onChange();
      return;
    }

    if (!isPlacingNow(state) || !view.held) return;

    const square = squareUnderPointer(event);
    if (!square) return;

    if (event.pointerType === "mouse") {
      view.hover = square;
      tryPlace();
      return;
    }

    // Touch: the first tap moves the ghost there; tapping the same square again places.
    const sameSquareTapped = view.hover && view.hover.row === square.row && view.hover.col === square.col;
    if (sameSquareTapped) {
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
      if (!state || cpuToAct(state) || !isPlacingNow(state) || placementOwner(state) !== player) return;

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

  // Movement: choose what the selected piece does.
  for (const action of ["slide", "rotate", "flip"]) {
    buttons[action + "Action"].addEventListener("click", () => {
      chooseAction(view, action);
      view.notice = "";
      onChange();
    });
  }

  // Movement: turn buttons. Pointing at one previews the turn; clicking plays it.
  [[buttons.turn90, 1], [buttons.turn180, 2], [buttons.turn270, 3]].forEach(([button, quarterTurns]) => {
    const show = () => { view.turnPreview = quarterTurns; onChange(); };
    const hide = () => { view.turnPreview = null; onChange(); };
    button.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") show(); });
    button.addEventListener("pointerleave", hide);
    button.addEventListener("focus", show);
    button.addEventListener("blur", hide);
    button.addEventListener("click", () => {
      const state = getState();
      const move = turnMove(state, view, playableMovesFor(state), quarterTurns);
      if (move) play(move);
    });
  });
  buttons.moveCancel.addEventListener("click", cancel);

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (view.paused || !getState()) return; // paused, or no game on screen
    const key = event.key.toLowerCase();
    if (key === "r") rotate(!event.shiftKey); // Shift+R turns the other way
    else if (key === "f") flip();
    else if (key === "escape") cancel();
    else if (key.startsWith("arrow") || key === "enter") keyboardPlacement(event, key);
  });

  // Placing a piece without a mouse: the arrow keys move the ghost, Enter places it.
  function keyboardPlacement(event, key) {
    const state = getState();
    if (!state || cpuToAct(state) || !((isPlacingNow(state) && view.held) || freeMoving())) return;
    if (document.activeElement && document.activeElement.tagName === "BUTTON") return; // let Enter press the button
    event.preventDefault();
    if (key === "enter") {
      tryPlace();
      return;
    }
    const step = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] }[key];
    const from = view.hover ?? { row: Math.floor(ROWS / 2), col: Math.floor(COLS / 2) };
    view.hover = {
      row: Math.min(ROWS - 1, Math.max(0, from.row + step[0])),
      col: Math.min(COLS - 1, Math.max(0, from.col + step[1])),
    };
    view.notice = "";
    onChange();
  }
}
