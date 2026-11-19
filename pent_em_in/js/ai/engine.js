// A fast game engine for the search. It plays the movement phase with the same
// rules as the game (a test checks it against getLegalMoves), but keeps the
// position in flat arrays and changes it in place, so the search can look at
// hundreds of thousands of positions a second.
//
// Nothing here is used by the game itself; the search turns its answer back
// into an ordinary move object at the end (see moveToObject).

import { DIRECTIONS, CHIP_DIRECTIONS, isStar } from "../rules.js";
import { ROWS, COLS } from "../constants.js";
import { externalCorners, rotateAboutVertex, flipOverSide, boundingBox, normalize, SIDES } from "../transforms.js";
import { WEIGHTS } from "./evaluate.js";

const SIZE = ROWS * COLS;
const CELLS_PER_PIECE = 5;

// --- the board's fixed squares ---

const STAR = new Uint8Array(SIZE);
for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) STAR[row * COLS + col] = isStar(row, col) ? 1 : 0;

const DIR_NAMES = ["up", "down", "left", "right"];
const DIR_ROW = DIR_NAMES.map((name) => DIRECTIONS[name][0]);
const DIR_COL = DIR_NAMES.map((name) => DIRECTIONS[name][1]);
const CHIP_ROW = CHIP_DIRECTIONS.map((step) => step[0]);
const CHIP_COL = CHIP_DIRECTIONS.map((step) => step[1]);

// --- orientations ---
// A piece is an orientation (its shape turned and flipped some way, with its
// top-left cell at 0,0) plus where that top-left cell sits on the board. Each
// orientation knows what every rotation and flip of it turns into, worked out
// once and remembered, so the search never has to turn cells around itself.

const orientByKey = new Map();
const orientations = [];

function internOrientation(cells) {
  const normalized = normalize(cells);
  const key = normalized.map(([row, col]) => row + "," + col).join(";");
  let found = orientByKey.get(key);
  if (!found) {
    found = {
      id: orientations.length,
      cells: normalized,
      rows: Int8Array.from(normalized.map(([row]) => row)),
      cols: Int8Array.from(normalized.map(([, col]) => col)),
      turns: null, // filled in the first time it is needed
    };
    orientByKey.set(key, found);
    orientations.push(found);
  }
  return found;
}

// Every rotation (about each outer corner, 1 to 3 quarter turns) and flip
// (over each side) of this orientation, as { to, dRow, dCol, ... }: the new
// orientation, and how far its top-left moves from the old top-left.
function turnsOf(orientation) {
  if (orientation.turns) return orientation.turns;
  const list = [];
  const add = (cells, extra) => {
    const box = boundingBox(cells);
    list.push({ to: internOrientation(cells), dRow: box.minRow, dCol: box.minCol, ...extra });
  };
  for (const pivot of externalCorners(orientation.cells)) {
    for (const quarterTurns of [1, 2, 3]) {
      add(rotateAboutVertex(orientation.cells, pivot, quarterTurns),
        { type: "rotate", pivotRow: pivot[0], pivotCol: pivot[1], quarterTurns });
    }
  }
  for (const side of SIDES) add(flipOverSide(orientation.cells, side), { type: "flip", side });
  orientation.turns = list;
  return list;
}

// --- the position ---

// Build the engine's position from a game state (movement phase).
export function buildPosition(state) {
  const pos = {
    pieceCount: state.pieces.length,
    pieceIds: state.pieces.map((piece) => piece.id),
    owner: new Int8Array(state.pieces.length),
    orient: new Int32Array(state.pieces.length),
    row0: new Int8Array(state.pieces.length),
    col0: new Int8Array(state.pieces.length),
    chipCount: state.chips.length,
    chipIds: state.chips.map((chip) => chip.id),
    chipOwner: new Int8Array(state.chips.length),
    chipRow: new Int8Array(state.chips.length),
    chipCol: new Int8Array(state.chips.length),
    occupied: new Uint8Array(SIZE), // 0 empty, 1 piece, 2 chip
    repeatPiece: [-1, -1, -1], // indexed by player (1 and 2); the piece moved on recent turns
    repeatCount: [0, 0, 0],
    lastWasChip: [false, false, false],
    stats: new Int32Array(3), // filled by generateMoves: piece moves, chip moves, nearly stuck pieces
  };

  state.pieces.forEach((piece, i) => {
    const box = boundingBox(piece.cells);
    pos.owner[i] = piece.owner;
    pos.orient[i] = internOrientation(piece.cells).id;
    pos.row0[i] = box.minRow;
    pos.col0[i] = box.minCol;
    for (const [row, col] of piece.cells) pos.occupied[row * COLS + col] = 1;
  });
  state.chips.forEach((chip, j) => {
    pos.chipOwner[j] = chip.owner;
    pos.chipRow[j] = chip.row;
    pos.chipCol[j] = chip.col;
    pos.occupied[chip.row * COLS + chip.col] = 2;
  });
  for (const player of [1, 2]) {
    const streak = state.repeat[player];
    pos.repeatPiece[player] = streak.pieceId === null || streak.pieceId === undefined ? -1 : pieceIndex(pos, streak.pieceId);
    pos.repeatCount[player] = streak.count ?? 0;
    pos.lastWasChip[player] = Boolean(state.lastWasChipMove[player]);
  }
  return pos;
}

function pieceIndex(pos, pieceId) {
  return pos.pieceIds.indexOf(pieceId);
}

// --- moves ---
// A move is one number: type (0 slide, 1 turn, 2 chip), then who (piece or
// chip number), then two details (slide: direction and distance; turn: which
// of the orientation's turns; chip: direction and distance).

const SLIDE = 0, TURN = 1, CHIP = 2;
const pack = (type, who, a, b) => (type << 24) | (who << 16) | (a << 8) | b;
const typeOf = (move) => move >> 24;
const whoOf = (move) => (move >> 16) & 255;
const aOf = (move) => (move >> 8) & 255;
const bOf = (move) => move & 255;

// Are all five cells of an orientation placed with its corner at (row, col) on
// empty, non-star squares of the board?
function fits(occupied, orientation, row, col) {
  const rows = orientation.rows;
  const cols = orientation.cols;
  for (let k = 0; k < CELLS_PER_PIECE; k++) {
    const r = row + rows[k];
    const c = col + cols[k];
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    const index = r * COLS + c;
    if (occupied[index] !== 0 || STAR[index] === 1) return false;
  }
  return true;
}

const pieceMoveCounts = new Int32Array(16);

// Write every legal move of `player` into `out` (or just count them if `out` is
// null) and return how many there are. pos.stats gets [piece moves, chip moves,
// pieces with 2 or fewer moves]. Same rules as getLegalMoves: no third turn in
// a row with one piece, no chip move straight after a chip move, and (when
// `piecesOnly`) no chip moves at all.
export function generateMoves(pos, player, out, piecesOnly = false) {
  const occupied = pos.occupied;
  let written = 0;
  let pieceTotal = 0;
  let chipTotal = 0;
  let nearlyStuck = 0;

  for (let i = 0; i < pos.pieceCount; i++) {
    if (pos.owner[i] !== player) continue;
    let count = 0;

    if (!(pos.repeatPiece[player] === i && pos.repeatCount[player] >= 2)) {
      const orientation = orientations[pos.orient[i]];
      const row0 = pos.row0[i];
      const col0 = pos.col0[i];
      const rows = orientation.rows;
      const cols = orientation.cols;

      // The piece itself doesn't block its own moves.
      for (let k = 0; k < CELLS_PER_PIECE; k++) occupied[(row0 + rows[k]) * COLS + col0 + cols[k]] = 0;

      for (let dir = 0; dir < 4; dir++) {
        for (let distance = 1; ; distance++) {
          // Anything in the way here also blocks every longer slide.
          if (!fits(occupied, orientation, row0 + DIR_ROW[dir] * distance, col0 + DIR_COL[dir] * distance)) break;
          if (out) out[written++] = pack(SLIDE, i, dir, distance);
          count++;
        }
      }

      const turns = turnsOf(orientation);
      for (let t = 0; t < turns.length; t++) {
        const turn = turns[t];
        if (fits(occupied, turn.to, row0 + turn.dRow, col0 + turn.dCol)) {
          if (out) out[written++] = pack(TURN, i, t, 0);
          count++;
        }
      }

      for (let k = 0; k < CELLS_PER_PIECE; k++) occupied[(row0 + rows[k]) * COLS + col0 + cols[k]] = 1;
    }

    pieceTotal += count;
    if (count <= 2) nearlyStuck++;
  }

  if (!piecesOnly && !pos.lastWasChip[player]) {
    for (let j = 0; j < pos.chipCount; j++) {
      if (pos.chipOwner[j] !== player) continue;
      for (let dir = 0; dir < 8; dir++) {
        for (let distance = 1; ; distance++) {
          const row = pos.chipRow[j] + CHIP_ROW[dir] * distance;
          const col = pos.chipCol[j] + CHIP_COL[dir] * distance;
          if (row < 0 || row >= ROWS || col < 0 || col >= COLS) break;
          const index = row * COLS + col;
          if (occupied[index] !== 0 || STAR[index] === 1) break;
          if (out) out[written++] = pack(CHIP, j, dir, distance);
          chipTotal++;
        }
      }
    }
  }

  pos.stats[0] = pieceTotal;
  pos.stats[1] = chipTotal;
  pos.stats[2] = nearlyStuck;
  return written || pieceTotal + chipTotal;
}

// --- making and unmaking moves ---
// The search plays a move, looks around, and takes it back. `undo` is a small
// Int32Array that remembers what the move changed.

export function makeMove(pos, move, player, undo) {
  const occupied = pos.occupied;
  const who = whoOf(move);

  if (typeOf(move) === CHIP) {
    undo[0] = pos.chipRow[who];
    undo[1] = pos.chipCol[who];
    undo[2] = pos.lastWasChip[player] ? 1 : 0;
    occupied[pos.chipRow[who] * COLS + pos.chipCol[who]] = 0;
    const dir = aOf(move);
    const distance = bOf(move);
    pos.chipRow[who] += CHIP_ROW[dir] * distance;
    pos.chipCol[who] += CHIP_COL[dir] * distance;
    occupied[pos.chipRow[who] * COLS + pos.chipCol[who]] = 2;
    pos.lastWasChip[player] = true;
    return;
  }

  const orientation = orientations[pos.orient[who]];
  undo[0] = pos.orient[who];
  undo[1] = pos.row0[who];
  undo[2] = pos.col0[who];
  undo[3] = pos.repeatPiece[player];
  undo[4] = pos.repeatCount[player];
  undo[5] = pos.lastWasChip[player] ? 1 : 0;

  for (let k = 0; k < CELLS_PER_PIECE; k++) occupied[(pos.row0[who] + orientation.rows[k]) * COLS + pos.col0[who] + orientation.cols[k]] = 0;
  if (typeOf(move) === SLIDE) {
    pos.row0[who] += DIR_ROW[aOf(move)] * bOf(move);
    pos.col0[who] += DIR_COL[aOf(move)] * bOf(move);
  } else {
    const turn = turnsOf(orientation)[aOf(move)];
    pos.orient[who] = turn.to.id;
    pos.row0[who] += turn.dRow;
    pos.col0[who] += turn.dCol;
  }
  const after = orientations[pos.orient[who]];
  for (let k = 0; k < CELLS_PER_PIECE; k++) occupied[(pos.row0[who] + after.rows[k]) * COLS + pos.col0[who] + after.cols[k]] = 1;

  if (pos.repeatPiece[player] === who) {
    pos.repeatCount[player]++;
  } else {
    pos.repeatPiece[player] = who;
    pos.repeatCount[player] = 1;
  }
  pos.lastWasChip[player] = false;
}

export function unmakeMove(pos, move, player, undo) {
  const occupied = pos.occupied;
  const who = whoOf(move);

  if (typeOf(move) === CHIP) {
    occupied[pos.chipRow[who] * COLS + pos.chipCol[who]] = 0;
    pos.chipRow[who] = undo[0];
    pos.chipCol[who] = undo[1];
    occupied[undo[0] * COLS + undo[1]] = 2;
    pos.lastWasChip[player] = undo[2] === 1;
    return;
  }

  const now = orientations[pos.orient[who]];
  for (let k = 0; k < CELLS_PER_PIECE; k++) occupied[(pos.row0[who] + now.rows[k]) * COLS + pos.col0[who] + now.cols[k]] = 0;
  pos.orient[who] = undo[0];
  pos.row0[who] = undo[1];
  pos.col0[who] = undo[2];
  const before = orientations[undo[0]];
  for (let k = 0; k < CELLS_PER_PIECE; k++) occupied[(undo[1] + before.rows[k]) * COLS + undo[2] + before.cols[k]] = 1;
  pos.repeatPiece[player] = undo[3];
  pos.repeatCount[player] = undo[4];
  pos.lastWasChip[player] = undo[5] === 1;
}

// A move as the ordinary move object the game understands.
export function moveToObject(pos, move) {
  const who = whoOf(move);
  if (typeOf(move) === CHIP) {
    return {
      type: "chip", chipId: pos.chipIds[who],
      to: {
        row: pos.chipRow[who] + CHIP_ROW[aOf(move)] * bOf(move),
        col: pos.chipCol[who] + CHIP_COL[aOf(move)] * bOf(move),
      },
    };
  }
  const pieceId = pos.pieceIds[who];
  if (typeOf(move) === SLIDE) {
    return { type: "slide", pieceId, direction: DIR_NAMES[aOf(move)], distance: bOf(move) };
  }
  const turn = turnsOf(orientations[pos.orient[who]])[aOf(move)];
  if (turn.type === "flip") return { type: "flip", pieceId, side: turn.side };
  return {
    type: "rotate", pieceId,
    pivot: [pos.row0[who] + turn.pivotRow, pos.col0[who] + turn.pivotCol],
    quarterTurns: turn.quarterTurns,
  };
}

// --- scoring ---

const mineStats = new Int32Array(3);

// The same score as evaluate() in evaluate.js, plus: if the player to move has
// no piece that can move, the game is over (WIN for me if it is them, minus
// WIN if it is me). `side` is whose turn it is.
export function staticScore(pos, me, side) {
  const them = me === 1 ? 2 : 1;

  generateMoves(pos, me, null);
  mineStats[0] = pos.stats[0]; mineStats[1] = pos.stats[1]; mineStats[2] = pos.stats[2];
  generateMoves(pos, them, null);
  const theirPieces = pos.stats[0], theirChips = pos.stats[1], theirNearly = pos.stats[2];

  if (side === me && mineStats[0] === 0) return -WEIGHTS.win;
  if (theirPieces === 0) return WEIGHTS.win;

  let score = WEIGHTS.pieceMoves * (mineStats[0] - theirPieces);
  score += WEIGHTS.chipMoves * (mineStats[1] - theirChips);
  score += WEIGHTS.nearlyStuck * (theirNearly - mineStats[2]);
  if (mineStats[0] === 0) score += WEIGHTS.loss;
  return score;
}
