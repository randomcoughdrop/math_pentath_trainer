// Draws the game state to the canvas. It only reads the state, never changes it.

import { COLS, ROWS, STARS, CHIP_STARTS, COLOR_SCHEMES, BOARD_COLORS } from "./constants.js";

// Public entry point: size the canvas, then draw everything.
export function render(canvas, state) {
  const layout = fitCanvas(canvas);
  if (!layout) return; // the canvas is hidden or has no size yet

  const ctx = canvas.getContext("2d");
  ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  drawBoard(ctx, state, layout);
}

// Match the canvas's pixel size to how big it appears on screen, so lines
// stay sharp on high-resolution screens. Returns the numbers drawing needs.
function fitCanvas(canvas) {
  const width = canvas.clientWidth;
  if (width === 0) return null;

  const dpr = window.devicePixelRatio || 1;
  const height = (width * ROWS) / COLS;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);

  // Only resize when needed; resizing clears the canvas.
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  return { width, height, dpr, pixelWidth, pixelHeight, cell: width / COLS };
}

export function drawBoard(ctx, state, layout) {
  const colors = COLOR_SCHEMES[state.settings.colorScheme];

  drawBackground(ctx, layout);
  drawStartSquares(ctx, layout, colors);
  drawGrid(ctx, layout);
  drawStars(ctx, layout);
  drawChips(ctx, state, layout, colors);
}

function drawBackground(ctx, { width, height }) {
  ctx.fillStyle = BOARD_COLORS.background;
  ctx.fillRect(0, 0, width, height);
}

// A light tint under each boot-and-hat square, so they stay marked after
// the chips move away.
function drawStartSquares(ctx, { cell }, colors) {
  ctx.globalAlpha = 0.18;
  for (const start of CHIP_STARTS) {
    ctx.fillStyle = colors[start.owner].fill;
    ctx.fillRect(start.col * cell, start.row * cell, cell, cell);
  }
  ctx.globalAlpha = 1;
}

function drawGrid(ctx, layout) {
  const { width, height, dpr, pixelWidth, pixelHeight, cell } = layout;

  ctx.strokeStyle = BOARD_COLORS.grid;
  ctx.lineWidth = 1 / dpr; // exactly one device pixel, so lines stay crisp
  ctx.beginPath();
  for (let col = 0; col <= COLS; col++) {
    const x = snapToPixel(col * cell, dpr, pixelWidth);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let row = 0; row <= ROWS; row++) {
    const y = snapToPixel(row * cell, dpr, pixelHeight);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

// Move a line to the middle of a device pixel so a thin line isn't blurry.
// The last line is pulled back inside the canvas so it isn't clipped.
function snapToPixel(position, dpr, totalPixels) {
  const pixel = Math.min(Math.round(position * dpr), totalPixels - 1);
  return (pixel + 0.5) / dpr;
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

function drawChips(ctx, state, { cell }, colors) {
  for (const chip of state.chips) {
    const look = colors[chip.owner];
    const centerX = (chip.col + 0.5) * cell;
    const centerY = (chip.row + 0.5) * cell;

    // The round chip itself.
    ctx.fillStyle = look.fill;
    ctx.strokeStyle = look.edge;
    ctx.lineWidth = Math.max(1.5, cell * 0.05);
    ctx.beginPath();
    ctx.arc(centerX, centerY, cell * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // The boot or hat drawn on top of it.
    const iconSize = cell * 0.7;
    drawIcon(ctx, chip.kind, centerX - iconSize / 2, centerY - iconSize / 2, iconSize, look.icon);
  }
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
