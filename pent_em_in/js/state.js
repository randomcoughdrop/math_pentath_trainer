// Creates the game state. It is plain data, so it is easy to copy and test.

import { CHIP_STARTS, PRESET_LEVELS } from "./constants.js";
import { SHAPE_NAMES } from "./pieces.js";

export function createInitialState(options = {}) {
  return {
    phase: "placement",
    currentPlayer: 1,
    startingPlayer: 1, // Phase 3 picks this at random
    settings: {
      level: options.level ?? PRESET_LEVELS.easy,
      colorScheme: options.colorScheme ?? "red-blue",
    },
    pieces: [],
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
