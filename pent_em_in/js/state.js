// Creates and copies the game state. It is plain data, so it is easy to copy and test.

import { CHIP_STARTS, PRESET_LEVELS } from "./constants.js";
import { SHAPE_NAMES } from "./pieces.js";

// options.startingPlayer is 1 or 2. The page picks it at random; tests choose it.
export function createInitialState(options = {}) {
  const startingPlayer = options.startingPlayer ?? 1;

  return {
    phase: "placement",
    currentPlayer: startingPlayer,
    startingPlayer,
    settings: {
      level: options.level ?? PRESET_LEVELS.easy,
      colorScheme: options.colorScheme ?? "red-blue",
    },
    pieces: [],
    nextPieceId: 0,
    chips: CHIP_STARTS.map((chip, index) => ({ id: index, ...chip })),
    // Each player starts with all 12 shapes available and chooses 5 of them.
    unusedShapes: { 1: [...SHAPE_NAMES], 2: [...SHAPE_NAMES] },
    placedCount: { 1: 0, 2: 0 },
    repeat: { 1: { pieceId: null, count: 0 }, 2: { pieceId: null, count: 0 } },
    lastWasChipMove: { 1: false, 2: false },
    lastTurn: null,
    strikes: { 1: 0, 2: 0 },
    history: [],
    moveLog: [],
    winner: null,
    winReason: null,
  };
}

export function otherPlayer(player) {
  return player === 1 ? 2 : 1;
}

// A full independent copy, so a move can build the next state without touching the old one.
export function copyState(state) {
  return structuredClone(state);
}
