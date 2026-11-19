// Draws the game state to the canvas. It only reads the state, never changes it.

import {
  COLS, ROWS, STARS, CHIP_STARTS, START_MARKERS, COLOR_SCHEMES, BOARD_COLORS,
} from "./constants.js";
import { SHAPE_NAMES, getShapeCells } from "./pieces.js";
import { boundingBox } from "./transforms.js";

// The piece tray shows all 12 shapes in a grid; each shape sits in its own
// square box, measured in board-cell units.
const TRAY_COLUMNS = 4;
const TRAY_ROWS = 3;
const TRAY_BOX = 6;

// Empty space around the board, in cells, so outlines on the edge aren't clipped.
const BOARD_MARGIN = 0.25;

// How a shape already placed on the board looks in the tray.
const USED_LOOK = { fill: "#dcd8cc", edge: "#b8b3a5" };

// How a ghost looks when the piece can't go where the cursor is.
const BLOCKED_LOOK = { fill: "#6b665a", edge: "#2d2a24" };

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

// Draw the board: grid, stars, markings, pieces, ghosts, hints, and chips.
// `extras` is optional, and only holds things that are not part of the game:
//   preview          { cells, ok }  the piece being held over the board (placement)
//   selectedPieceId  a piece to outline
//   selectedChipId   a chip to ring
//   destinations     [[row, col], ...] squares to mark as places to click
//   corners          [[row, col], ...] grid corners to mark as places to pivot
//   pivot            [row, col] the corner that has been chosen
//   ghosts           [{ cells }] see-through pieces showing where a move would land
//   faintPieceId     a piece being moved freely: drawn very faintly where it still stands
//   animation        { ...animation (see animation.js), progress } a piece or chip caught mid-move
export function render(canvas, state, extras = {}) {
  const layout = fitCanvas(canvas, COLS + 2 * BOARD_MARGIN, ROWS + 2 * BOARD_MARGIN);
  if (!layout) return; // the canvas is hidden or has no size yet

  const ctx = canvas.getContext("2d");
  ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);

  // Fill the margin, then draw the board inside it. The offset is a whole
  // number of device pixels so grid lines stay crisp.
  ctx.fillStyle = BOARD_COLORS.background;
  ctx.fillRect(0, 0, layout.width, layout.height);
  const offset = Math.round(BOARD_MARGIN * layout.cell * layout.dpr);
  ctx.translate(offset / layout.dpr, offset / layout.dpr);

  const boardLayout = {
    ...layout,
    width: COLS * layout.cell,
    height: ROWS * layout.cell,
    pixelWidth: Math.round(COLS * layout.cell * layout.dpr),
    pixelHeight: Math.round(ROWS * layout.cell * layout.dpr),
  };
  drawBoard(ctx, state, boardLayout, extras);
}

// Draw one player's piece tray. Shapes that player has already placed are
// greyed out. `held` is optional: { shape, cells } for the piece they are
// holding, which is highlighted and drawn in its current orientation.
export function renderTray(canvas, state, player, held = null) {
  const layout = fitCanvas(canvas, TRAY_COLUMNS * TRAY_BOX, TRAY_ROWS * TRAY_BOX);
  if (!layout) return;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  drawTray(ctx, state, player, held, layout);
}

// ---------------------------------------------------------------------------
// Pointing at things (pure math, used by input.js)
// ---------------------------------------------------------------------------

// Which board square is at pixel (x, y) on a board canvas drawn `width` pixels
// wide (margin included)? Returns { row, col }, or null if the point is
// outside the board.
export function boardCellFromPoint(x, y, width) {
  const cell = width / (COLS + 2 * BOARD_MARGIN);
  const boardX = x - BOARD_MARGIN * cell;
  const boardY = y - BOARD_MARGIN * cell;
  const col = Math.floor(boardX / cell);
  const row = Math.floor(boardY / cell);
  if (boardX < 0 || boardY < 0 || col >= COLS || row >= ROWS) return null;
  return { row, col };
}

// Which grid corner (where four squares meet) is near pixel (x, y)? Returns
// [row, col] of the corner (the top-left corner of square [row, col]), or null
// if the point isn't close to one. Used to pick a pivot for rotating.
export function vertexFromPoint(x, y, width) {
  const cell = width / (COLS + 2 * BOARD_MARGIN);
  const boardX = x / cell - BOARD_MARGIN;
  const boardY = y / cell - BOARD_MARGIN;
  const col = Math.round(boardX);
  const row = Math.round(boardY);
  if (Math.hypot(boardX - col, boardY - row) > 0.3) return null;
  if (col < 0 || col > COLS || row < 0 || row > ROWS) return null;
  return [row, col];
}

// Which tray box (0 to 11, in SHAPE_NAMES order) is at pixel (x, y) on a tray
// drawn `width` pixels wide? Returns null if the point is outside the tray.
export function trayIndexFromPoint(x, y, width) {
  const box = width / TRAY_COLUMNS;
  const col = Math.floor(x / box);
  const row = Math.floor(y / box);
  if (x < 0 || y < 0 || col >= TRAY_COLUMNS || row >= TRAY_ROWS) return null;
  return row * TRAY_COLUMNS + col;
}

// ---------------------------------------------------------------------------
// Canvas sizing
// ---------------------------------------------------------------------------

// Match the canvas's pixel size to how big it appears on screen, so lines
// stay sharp on high-resolution screens. unitsWide and unitsTall say how many
// squares the drawing is. Returns the numbers drawing needs; "cell" is the
// size of one square in screen pixels.
function fitCanvas(canvas, unitsWide, unitsTall) {
  const width = canvas.clientWidth;
  if (width === 0) return null;

  const dpr = window.devicePixelRatio || 1;
  const height = (width * unitsTall) / unitsWide;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);

  // Only resize when needed; resizing clears the canvas.
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  return { width, height, dpr, pixelWidth, pixelHeight, cell: width / unitsWide };
}

// Move a line to the middle of a device pixel so a thin line isn't blurry.
// The last line is pulled back inside the canvas so it isn't clipped.
function snapToPixel(position, dpr, totalPixels) {
  const pixel = Math.min(Math.round(position * dpr), totalPixels - 1);
  return (pixel + 0.5) / dpr;
}

// Draw a grid of thin lines: `columns` x `rows` squares of size layout.cell * step.
function drawGridLines(ctx, layout, columns, rows, step) {
  const { width, height, dpr, pixelWidth, pixelHeight, cell } = layout;

  ctx.strokeStyle = BOARD_COLORS.grid;
  ctx.lineWidth = 1 / dpr; // exactly one device pixel, so lines stay crisp
  ctx.beginPath();
  for (let col = 0; col <= columns; col++) {
    const x = snapToPixel(col * step * cell, dpr, pixelWidth);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let row = 0; row <= rows; row++) {
    const y = snapToPixel(row * step * cell, dpr, pixelHeight);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

export function drawBoard(ctx, state, layout, extras = {}) {
  const colors = COLOR_SCHEMES[state.settings.colorScheme];

  drawBackground(ctx, layout);
  drawStartSquares(ctx, layout, colors);
  drawGridLines(ctx, layout, COLS, ROWS, 1);
  drawStars(ctx, layout);
  drawStartMarkers(ctx, layout, colors);
  drawPieces(ctx, state, layout, colors, extras.dimmedPieceIds, extras.animation, extras.faintPieceId);
  drawMovingPiece(ctx, layout, colors, state, extras.animation);
  drawSelection(ctx, state, layout, extras);
  drawHighlight(ctx, layout, extras);
  for (const ghost of extras.ghosts ?? []) {
    drawGhost(ctx, state, layout, colors, { cells: ghost.cells, ok: true });
  }
  if (extras.preview) drawGhost(ctx, state, layout, colors, extras.preview);
  drawChips(ctx, state, layout, colors, extras.animation);
  drawMovingChip(ctx, layout, colors, state, extras.animation);
  drawHints(ctx, layout, extras);
  drawStreakBadges(ctx, state, layout);
}

function drawBackground(ctx, { width, height }) {
  ctx.fillStyle = BOARD_COLORS.background;
  ctx.fillRect(0, 0, width, height);
}

// A light tint under each starting square, in its owner's color.
function drawStartSquares(ctx, { cell }, colors) {
  ctx.globalAlpha = 0.18;
  for (const start of CHIP_STARTS) {
    ctx.fillStyle = colors[start.owner].fill;
    ctx.fillRect(start.col * cell, start.row * cell, cell, cell);
  }
  ctx.globalAlpha = 1;
}

function drawStars(ctx, { cell }) {
  ctx.fillStyle = BOARD_COLORS.star;
  ctx.strokeStyle = BOARD_COLORS.starEdge;
  ctx.lineWidth = Math.max(1, cell * 0.03);
  for (const star of STARS) {
    const centerX = (star.col + 0.5) * cell;
    const centerY = (star.row + 0.5) * cell;
    drawStarShape(ctx, centerX, centerY, cell * 0.38, cell * 0.16);
  }
}

// A five-point star: points alternate between the outer and inner radius.
function drawStarShape(ctx, centerX, centerY, outerRadius, innerRadius) {
  ctx.beginPath();
  for (let point = 0; point < 10; point++) {
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    if (point === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// The boot or hat printed on each starting square. It is part of the board,
// so it stays visible after the chip on it moves away.
function drawStartMarkers(ctx, { cell }, colors) {
  const size = cell * 0.92;
  ctx.globalAlpha = 0.7;
  for (const start of CHIP_STARTS) {
    const left = start.col * cell + (cell - size) / 2;
    const top = start.row * cell + (cell - size) / 2;
    drawIcon(ctx, START_MARKERS[start.owner], left, top, size, colors[start.owner].edge);
  }
  ctx.globalAlpha = 1;
}

// Pieces placed on the board. Their cells are in board coordinates.
function drawPieces(ctx, state, { cell }, colors, dimmed = [], animation = null, faintPieceId = null) {
  for (const piece of state.pieces) {
    if (animation && animation.pieceId === piece.id) continue; // drawn by drawMovingPiece
    if (piece.id === faintPieceId) {
      ctx.globalAlpha = 0.2; // where the piece was, while it is carried
      drawCells(ctx, piece.cells, 0, 0, cell, colors[piece.owner]);
      ctx.globalAlpha = 1;
      continue;
    }
    drawCells(ctx, piece.cells, 0, 0, cell, colors[piece.owner]);
    // Easy only: a piece with no legal move is slightly washed out.
    if (dimmed.includes(piece.id)) {
      ctx.globalAlpha = 0.4;
      drawCells(ctx, piece.cells, 0, 0, cell, BLOCKED_LOOK);
      ctx.globalAlpha = 1;
    }
  }
}

// The see-through preview of the piece being held. If it can be placed there it
// looks like the piece in its owner's color; if not, it is grey with a slash
// through every square (a shape cue, so it never depends on telling colors apart).
function drawGhost(ctx, state, { cell }, colors, preview) {

  // "plain" previews (Hard) never warn: the piece always looks the same.
  if (preview.ok || preview.plain) {
    ctx.globalAlpha = 0.6;
    drawCells(ctx, preview.cells, 0, 0, cell, colors[preview.owner ?? state.currentPlayer]);
    ctx.globalAlpha = 1;
    return;
  }

  ctx.globalAlpha = 0.55;
  drawCells(ctx, preview.cells, 0, 0, cell, BLOCKED_LOOK);
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = BLOCKED_LOOK.edge;
  ctx.lineWidth = Math.max(2, cell * 0.06);
  ctx.beginPath();
  for (const [row, col] of preview.cells) {
    ctx.moveTo(col * cell + cell * 0.2, row * cell + cell * 0.2);
    ctx.lineTo(col * cell + cell * 0.8, row * cell + cell * 0.8);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// A dashed outline around the squares the computer just played on.
function drawHighlight(ctx, { cell }, extras) {
  if (!extras.highlightCells) return;
  ctx.save();
  ctx.strokeStyle = BOARD_COLORS.selected;
  ctx.lineWidth = Math.max(3, cell * 0.08);
  ctx.setLineDash([cell * 0.15, cell * 0.1]);
  strokeOuterEdges(ctx, extras.highlightCells, 0, 0, cell);
  ctx.restore();
}

// A bright outline around the selected piece, and a ring around the selected chip.
function drawSelection(ctx, state, { cell }, extras) {
  const piece = state.pieces.find((candidate) => candidate.id === extras.selectedPieceId);
  if (piece) {
    ctx.strokeStyle = BOARD_COLORS.selected;
    ctx.lineWidth = Math.max(4, cell * 0.14);
    strokeOuterEdges(ctx, piece.cells, 0, 0, cell);
  }

  const chip = state.chips.find((candidate) => candidate.id === extras.selectedChipId);
  if (chip) {
    ctx.strokeStyle = BOARD_COLORS.selected;
    ctx.lineWidth = Math.max(3, cell * 0.1);
    ctx.beginPath();
    ctx.arc((chip.col + 0.5) * cell, (chip.row + 0.5) * cell, cell * 0.36, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Dots on squares that can be clicked, and on grid corners a piece can pivot around.
function drawHints(ctx, { cell }, extras) {
  ctx.lineWidth = Math.max(1.5, cell * 0.04);

  for (const [row, col] of extras.destinations ?? []) {
    ctx.fillStyle = "rgba(255, 241, 168, 0.95)";
    ctx.strokeStyle = BOARD_COLORS.starEdge;
    ctx.beginPath();
    ctx.arc((col + 0.5) * cell, (row + 0.5) * cell, cell * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (const [row, col] of extras.corners ?? []) {
    const chosen = extras.pivot && extras.pivot[0] === row && extras.pivot[1] === col;
    ctx.fillStyle = chosen ? BOARD_COLORS.selected : "#ffffff";
    ctx.strokeStyle = "#2d2a24";
    ctx.beginPath();
    ctx.arc(col * cell, row * cell, cell * (chosen ? 0.17 : 0.13), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// A small "x2" badge on a piece that its owner has moved twice in a row: it
// can't be moved a third time.
function drawStreakBadges(ctx, state, { cell }) {
  for (const piece of state.pieces) {
    const streak = state.repeat[piece.owner];
    if (streak.pieceId !== piece.id || streak.count < 2) continue;

    // Put the badge on the piece's top-left square, at its upper-right corner.
    const [row, col] = [...piece.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
    const x = (col + 1) * cell - cell * 0.22;
    const y = row * cell + cell * 0.22;

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#2d2a24";
    ctx.lineWidth = Math.max(1.5, cell * 0.04);
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#2d2a24";
    ctx.font = "bold " + Math.round(cell * 0.24) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u00d7" + streak.count, x, y + cell * 0.01);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
}

// A piece in the middle of a move, drawn from where it started and carried
// partway (animation.progress, 0 to 1) by a slide, a swing, or a flip.
function drawMovingPiece(ctx, { cell }, colors, state, animation) {
  if (!animation || animation.kind === "chip") return;
  const piece = state.pieces.find((candidate) => candidate.id === animation.pieceId);
  if (!piece) return;
  const t = animation.progress;

  ctx.save();
  if (animation.kind === "slide") {
    ctx.translate(animation.cols * t * cell, animation.rows * t * cell);
  } else if (animation.kind === "rotate") {
    const [pivotRow, pivotCol] = animation.pivot;
    ctx.translate(pivotCol * cell, pivotRow * cell);
    ctx.rotate(t * animation.quarterTurns * Math.PI / 2); // clockwise
    ctx.translate(-pivotCol * cell, -pivotRow * cell);
  } else {
    // A flip squashes the piece flat against its edge and out the other side.
    const squash = 1 - 2 * t;
    const along = animation.axis * cell;
    if (animation.side === "left" || animation.side === "right") {
      ctx.translate(along, 0);
      ctx.scale(squash, 1);
      ctx.translate(-along, 0);
    } else {
      ctx.translate(0, along);
      ctx.scale(1, squash);
      ctx.translate(0, -along);
    }
  }
  // A soft shadow so the moving piece looks lifted.
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = cell * 0.25;
  drawCells(ctx, animation.cells, 0, 0, cell, colors[piece.owner]);
  ctx.restore();
}

// A chip rolling from one square to another.
function drawMovingChip(ctx, { cell }, colors, state, animation) {
  if (!animation || animation.kind !== "chip") return;
  const chip = state.chips.find((candidate) => candidate.id === animation.chipId);
  if (!chip) return;
  const t = animation.progress;
  const row = animation.from.row + (animation.to.row - animation.from.row) * t;
  const col = animation.from.col + (animation.to.col - animation.from.col) * t;
  drawChipDisc(ctx, (col + 0.5) * cell, (row + 0.5) * cell, cell, colors[chip.owner]);
}

// Chips are plain solid discs in the owner's color.
function drawChips(ctx, state, { cell }, colors, animation = null) {
  for (const chip of state.chips) {
    if (animation && animation.chipId === chip.id) continue; // drawn by drawMovingChip
    drawChipDisc(ctx, (chip.col + 0.5) * cell, (chip.row + 0.5) * cell, cell, colors[chip.owner]);
  }
}

function drawChipDisc(ctx, centerX, centerY, cell, look) {
  ctx.fillStyle = look.fill;
  ctx.strokeStyle = look.edge;
  ctx.lineWidth = Math.max(1.5, cell * 0.05);
  ctx.beginPath();
  ctx.arc(centerX, centerY, cell * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// Boot and hat are simple silhouettes drawn in a 1 x 1 box, then scaled to fit.
function drawIcon(ctx, kind, left, top, size, color) {
  ctx.save();
  ctx.translate(left, top);
  ctx.scale(size, size);
  ctx.fillStyle = color;

  if (kind === "boot") {
    ctx.beginPath();
    ctx.moveTo(0.3, 0.12);
    ctx.lineTo(0.56, 0.12);
    ctx.lineTo(0.56, 0.56);
    ctx.quadraticCurveTo(0.9, 0.56, 0.9, 0.74);
    ctx.quadraticCurveTo(0.9, 0.88, 0.76, 0.88);
    ctx.lineTo(0.3, 0.88);
    ctx.closePath();
    ctx.fill();
  } else {
    // Hat: a wide brim under a tall crown.
    ctx.beginPath();
    ctx.ellipse(0.5, 0.72, 0.5, 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.27, 0.7);
    ctx.lineTo(0.3, 0.22);
    ctx.quadraticCurveTo(0.5, 0.08, 0.7, 0.22);
    ctx.lineTo(0.73, 0.7);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Pieces (used by the board, the ghost, and the tray)
// ---------------------------------------------------------------------------

// Draw one pentomino. Cell [row, col] is drawn at (left + col * unit, top + row * unit).
// "look" supplies the fill and edge colors.
function isPlayerTwoLook(look) {
  return Object.values(COLOR_SCHEMES).some((scheme) => scheme[2] === look);
}

function hatch(ctx, cells, left, top, unit, color) {
  for (const [row, col] of cells) {
    const x = left + col * unit, y = top + row * unit;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, unit, unit);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1.5, unit * 0.06);
    ctx.beginPath();
    for (let k = -1; k <= 2; k++) {
      ctx.moveTo(x + k * unit * 0.5, y + unit);
      ctx.lineTo(x + k * unit * 0.5 + unit, y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// Player 2's pieces get diagonal hatching when patterns are on.
let patternsOn = false;
export function setPatterns(on) {
  patternsOn = on;
}

function drawCells(ctx, cells, left, top, unit, look) {
  // Solid squares.
  ctx.fillStyle = look.fill;
  for (const [row, col] of cells) {
    ctx.fillRect(left + col * unit, top + row * unit, unit, unit);
  }

  if (patternsOn && isPlayerTwoLook(look)) hatch(ctx, cells, left, top, unit, look.edge);

  // Faint lines between the squares of the piece, so you can count them.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1;
  for (const [row, col] of cells) {
    ctx.strokeRect(left + col * unit, top + row * unit, unit, unit);
  }

  // A heavier outline, only along edges that touch empty space.
  ctx.strokeStyle = look.edge;
  ctx.lineWidth = Math.max(2, unit * 0.08);
  strokeOuterEdges(ctx, cells, left, top, unit);
}

// Stroke (with the current stroke style) only the edges of the piece that
// touch empty space.
function strokeOuterEdges(ctx, cells, left, top, unit) {
  const owned = new Set(cells.map(([row, col]) => row + "," + col));

  ctx.lineCap = "square";
  ctx.beginPath();
  for (const [row, col] of cells) {
    const x = left + col * unit;
    const y = top + row * unit;
    if (!owned.has(row - 1 + "," + col)) { ctx.moveTo(x, y); ctx.lineTo(x + unit, y); }
    if (!owned.has(row + 1 + "," + col)) { ctx.moveTo(x, y + unit); ctx.lineTo(x + unit, y + unit); }
    if (!owned.has(row + "," + (col - 1))) { ctx.moveTo(x, y); ctx.lineTo(x, y + unit); }
    if (!owned.has(row + "," + (col + 1))) { ctx.moveTo(x + unit, y); ctx.lineTo(x + unit, y + unit); }
  }
  ctx.stroke();
  ctx.lineCap = "butt";
}

// ---------------------------------------------------------------------------
// The piece tray
// ---------------------------------------------------------------------------

function drawTray(ctx, state, player, held, layout) {
  const { width, height, cell } = layout;
  const look = COLOR_SCHEMES[state.settings.colorScheme][player];
  const unused = state.unusedShapes[player];
  const boxSize = TRAY_BOX * cell;

  ctx.fillStyle = BOARD_COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Highlight the box of the piece being held.
  SHAPE_NAMES.forEach((name, index) => {
    if (!held || held.shape !== name) return;
    ctx.fillStyle = BOARD_COLORS.highlight;
    ctx.fillRect((index % TRAY_COLUMNS) * boxSize, Math.floor(index / TRAY_COLUMNS) * boxSize, boxSize, boxSize);
  });

  drawGridLines(ctx, layout, TRAY_COLUMNS, TRAY_ROWS, TRAY_BOX);

  SHAPE_NAMES.forEach((name, index) => {
    const boxLeft = (index % TRAY_COLUMNS) * boxSize;
    const boxTop = Math.floor(index / TRAY_COLUMNS) * boxSize;

    // The held piece is shown in whatever orientation it currently has.
    const isHeld = held && held.shape === name;
    const cells = isHeld ? held.cells : getShapeCells(name);

    // Center the shape in its box.
    const box = boundingBox(cells);
    const shapeWidth = box.maxCol - box.minCol + 1;
    const shapeHeight = box.maxRow - box.minRow + 1;
    const left = boxLeft + ((TRAY_BOX - shapeWidth) / 2 - box.minCol) * cell;
    const top = boxTop + ((TRAY_BOX - shapeHeight) / 2 - box.minRow) * cell;

    drawCells(ctx, cells, left, top, cell, unused.includes(name) ? look : USED_LOOK);

    // The shape's letter, small, in the bottom-left corner of its box.
    ctx.fillStyle = BOARD_COLORS.grid;
    ctx.font = Math.round(cell * 0.9) + "px system-ui, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(name, boxLeft + cell * 0.35, boxTop + (TRAY_BOX - 0.35) * cell);
  });
}
