// Slide, rotate-about-corner, and flip math on lists of cells.
//
// A cell is [row, col]. A "vertex" is a grid corner between cells: vertex
// [r, c] is the top-left corner of cell [r, c]. Rotations pivot around vertices.
//
// None of these functions change the list they are given; they return a new one.

export const SIDES = ["top", "bottom", "left", "right"];

// Move every cell by dr rows and dc columns.
export function slideCells(cells, dr, dc) {
  return cells.map(([row, col]) => [row + dr, col + dc]);
}

// Rotate clockwise by quarterTurns x 90 degrees around a vertex.
export function rotateAboutVertex(cells, pivot, quarterTurns) {
  const [pivotRow, pivotCol] = pivot;
  const turns = ((quarterTurns % 4) + 4) % 4;

  let result = cells.map(([row, col]) => [row, col]);
  for (let turn = 0; turn < turns; turn++) {
    // One clockwise quarter turn around the vertex.
    result = result.map(([row, col]) => [
      pivotRow + (col - pivotCol),
      pivotCol + pivotRow - row - 1,
    ]);
  }
  return result;
}

// The smallest rectangle (in cells) that contains the piece.
export function boundingBox(cells) {
  const rows = cells.map(([row]) => row);
  const cols = cells.map(([, col]) => col);
  return {
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
    minCol: Math.min(...cols),
    maxCol: Math.max(...cols),
  };
}

// Flip the piece over one side of its bounding rectangle, like turning a page.
// "top" mirrors it across the line along its top edge, so it lands just above
// where it was. Notches and dents in the outline don't matter; only the four
// sides of the rectangle count.
export function flipOverSide(cells, side) {
  const box = boundingBox(cells);

  if (side === "top") return cells.map(([row, col]) => [2 * box.minRow - row - 1, col]);
  if (side === "bottom") return cells.map(([row, col]) => [2 * box.maxRow + 1 - row, col]);
  if (side === "left") return cells.map(([row, col]) => [row, 2 * box.minCol - col - 1]);
  if (side === "right") return cells.map(([row, col]) => [row, 2 * box.maxCol + 1 - col]);

  throw new Error("Unknown side: " + side);
}

// How many of the four cells touching a vertex belong to the piece (0 to 4).
export function vertexCellCount(cells, vertex) {
  const [vertexRow, vertexCol] = vertex;
  const owned = new Set(cells.map(([row, col]) => row + "," + col));
  const around = [
    [vertexRow - 1, vertexCol - 1],
    [vertexRow - 1, vertexCol],
    [vertexRow, vertexCol - 1],
    [vertexRow, vertexCol],
  ];
  return around.filter(([row, col]) => owned.has(row + "," + col)).length;
}

// External corners: vertices touched by exactly one cell of the piece. These
// are the outward-pointing (convex) corners of the outline, and they are the
// places a piece may pivot when it rotates.
export function externalCorners(cells) {
  const seen = new Set();
  const corners = [];

  for (const [row, col] of cells) {
    for (const vertex of [[row, col], [row, col + 1], [row + 1, col], [row + 1, col + 1]]) {
      const key = vertex[0] + "," + vertex[1];
      if (seen.has(key)) continue;
      seen.add(key);
      if (vertexCellCount(cells, vertex) === 1) corners.push(vertex);
    }
  }

  return corners.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// Shift the piece so its top-left is at [0, 0], with cells in reading order.
// Two pieces with the same normalized cells are the same shape in the same
// orientation, wherever they sit on the board.
export function normalize(cells) {
  const box = boundingBox(cells);
  return cells
    .map(([row, col]) => [row - box.minRow, col - box.minCol])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// A text key for a piece's normalized cells, handy for comparing and de-duplicating.
export function shapeKey(cells) {
  return normalize(cells).map(([row, col]) => row + "," + col).join(";");
}

// Every distinct way the piece can be turned or flipped, each normalized.
// Most pieces have 8; symmetrical ones have fewer (X has 1, I has 2).
export function orientations(cells) {
  const found = new Map();

  for (const flipped of [false, true]) {
    const start = flipped ? flipOverSide(cells, "left") : cells;
    for (let turns = 0; turns < 4; turns++) {
      const turned = rotateAboutVertex(start, [0, 0], turns);
      found.set(shapeKey(turned), normalize(turned));
    }
  }

  return [...found.values()];
}
