// Short animations for moves: a slide glides, a rotation swings around its
// pivot, a flip turns over its edge, a chip rolls to its new square.
//
// An animation is plain data made from the position before a move and the move
// itself. `animationFrame` says how far along it is at a given time, and the
// renderer draws the moving piece from that. The game state is already the
// finished position; the animation only affects how it is drawn for a moment.

import { boundingBox } from "./transforms.js";
import { DIRECTIONS } from "./rules.js";

// How long each kind of move takes, in milliseconds.
export function durationFor(move) {
  if (move.type === "slide" || move.type === "chip") return Math.min(380, 130 + 55 * Math.max(1, move.distance ?? 1));
  if (move.type === "rotate") return 280 + 90 * move.quarterTurns;
  if (move.type === "flip") return 340;
  return 0;
}

// The animation for a move, or null if it shouldn't be animated (placing a
// piece, challenge decisions, and so on). `before` is the state before the move.
export function createAnimation(before, move, startTime) {
  if (move.type === "chip" || move.type === "relocate-chip") {
    const chip = before.chips.find((candidate) => candidate.id === move.chipId);
    if (!chip) return null;
    const distance = Math.max(Math.abs(move.to.row - chip.row), Math.abs(move.to.col - chip.col));
    return {
      kind: "chip", chipId: chip.id, startTime,
      duration: durationFor({ type: "chip", distance }),
      from: { row: chip.row, col: chip.col }, to: { row: move.to.row, col: move.to.col },
    };
  }

  if (!["slide", "rotate", "flip"].includes(move.type)) return null;
  const piece = before.pieces.find((candidate) => candidate.id === move.pieceId);
  if (!piece) return null;

  const animation = { kind: move.type, pieceId: piece.id, startTime, duration: durationFor(move), cells: piece.cells };
  if (move.type === "slide") {
    const [stepRow, stepCol] = DIRECTIONS[move.direction];
    animation.rows = stepRow * move.distance;
    animation.cols = stepCol * move.distance;
  } else if (move.type === "rotate") {
    animation.pivot = move.pivot;
    animation.quarterTurns = move.quarterTurns;
  } else {
    const box = boundingBox(piece.cells);
    animation.side = move.side;
    // The edge it turns over: a line at this row (top, bottom) or column (left, right).
    animation.axis = { top: box.minRow, bottom: box.maxRow + 1, left: box.minCol, right: box.maxCol + 1 }[move.side];
  }
  return animation;
}

// Starts and ends gently.
export function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// How far along the animation is at `now`: { progress, done }, with progress
// from 0 to 1 after easing.
export function animationFrame(animation, now) {
  const raw = animation.duration <= 0 ? 1 : (now - animation.startTime) / animation.duration;
  const clamped = Math.min(1, Math.max(0, raw));
  return { progress: ease(clamped), done: raw >= 1 };
}

// Should motion be skipped? Some people turn animations off in their system settings.
export function reducedMotion() {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (error) {
    return false;
  }
}
