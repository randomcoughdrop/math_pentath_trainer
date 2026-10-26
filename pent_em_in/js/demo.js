// TEMPORARY (Phase 2): puts a few sample pieces on the board so the drawing and
// transform code can be checked by eye. Add ?demo=pieces to the page address.
// This file goes away once placing pieces works in Phase 3.

import { getShapeCells } from "./pieces.js";
import { rotateAboutVertex, flipOverSide, slideCells, normalize } from "./transforms.js";

export function addDemoPieces(state) {
  const samples = [
    // owner, shape, how to turn it, where its top-left lands (row, col)
    { owner: 1, shape: "F", turn: (cells) => cells, at: [0, 3] },
    { owner: 1, shape: "L", turn: (cells) => rotateAboutVertex(cells, [0, 0], 1), at: [4, 0] },
    { owner: 1, shape: "N", turn: (cells) => flipOverSide(cells, "left"), at: [5, 4] },
    { owner: 2, shape: "U", turn: (cells) => cells, at: [0, 8] },
    { owner: 2, shape: "Z", turn: (cells) => cells, at: [3, 9] },
    { owner: 2, shape: "W", turn: (cells) => cells, at: [5, 8] },
  ];

  samples.forEach((sample, index) => {
    const turned = normalize(sample.turn(getShapeCells(sample.shape)));
    state.pieces.push({
      id: index,
      owner: sample.owner,
      shape: sample.shape,
      cells: slideCells(turned, sample.at[0], sample.at[1]),
    });

    // The shape is now used, so it is greyed out in its owner's tray.
    state.unusedShapes[sample.owner] = state.unusedShapes[sample.owner].filter(
      (name) => name !== sample.shape,
    );
  });
}
