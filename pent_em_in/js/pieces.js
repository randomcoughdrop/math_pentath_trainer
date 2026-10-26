// The 12 pentomino shapes, named by the letter they resemble.
//
// Each shape is a list of [row, col] cells. The drawings below show the
// starting orientation; any rotation or flip is just another orientation
// of the same shape.

export const SHAPES = {
  F: [[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]],
  //   .XX
  //   XX.
  //   .X.

  I: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  //   XXXXX

  L: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]],
  //   X.
  //   X.
  //   X.
  //   XX

  N: [[0, 1], [1, 1], [2, 0], [2, 1], [3, 0]],
  //   .X
  //   .X
  //   XX
  //   X.

  P: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]],
  //   XX
  //   XX
  //   X.

  T: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]],
  //   XXX
  //   .X.
  //   .X.

  U: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]],
  //   X.X
  //   XXX

  V: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
  //   X..
  //   X..
  //   XXX

  W: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  //   X..
  //   XX.
  //   .XX

  X: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
  //   .X.
  //   XXX
  //   .X.

  Y: [[0, 1], [1, 0], [1, 1], [2, 1], [3, 1]],
  //   .X
  //   XX
  //   .X
  //   .X

  Z: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]],
  //   XX.
  //   .X.
  //   .XX
};

// The names in a fixed order (used by the piece tray).
export const SHAPE_NAMES = Object.keys(SHAPES);

// A fresh copy of a shape's cells, safe to change.
export function getShapeCells(name) {
  return SHAPES[name].map(([row, col]) => [row, col]);
}
