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
      players: options.players ?? { 1: "human", 2: "human" }, // each "human" or "cpu"
    },
    pieces: [],
    nextPieceId: 0,
    chips: CHIP_STARTS.map((chip, index) => ({ id: index, ...chip })),
    // Each player starts with all 12 shapes available and chooses 5 of them.
    unusedShapes: { 1: [...SHAPE_NAMES], 2: [...SHAPE_NAMES] },
    placedCount: { 1: 0, 2: 0 },
    repeat: { 1: { pieceId: null, count: 0 }, 2: { pieceId: null, count: 0 } },
    lastWasChipMove: { 1: false, 2: false },
    lastTurn: null, // { player, move, violations } of the most recent turn; null once it can't be challenged
    strikes: { 1: 0, 2: 0 }, // incorrect challenges; three loses the game
    pending: null, // a challenge decision someone still has to make (see challenges.js)
    mustMovePiece: false, // the player to move was forced to move a pentomino, not a chip
    forcedBy: null, // when set, that player (the challenge winner) chooses the move of the current player's piece
    winChallenged: false, // the loser has already challenged the declared win
    history: [],
    moveLog: [],
    timeCalled: false, // the game cap ran out; the game ends after timeEndsAfter's turn
    timeEndsAfter: null,
    winner: null, // 1, 2, or null (null with phase "gameover" is a tie)
    winReason: null, // "placement", "entrapment", "time"
  };
}

export function otherPlayer(player) {
  return player === 1 ? 2 : 1;
}

// A full independent copy, so a move can build the next state without touching the old one.
// The saved snapshots in `history` are never changed once made, so the copy shares
// them (in a new list) instead of cloning every one: that keeps long games fast.
export function copyState(state) {
  const { history, ...rest } = state;
  const copy = structuredClone(rest);
  copy.history = [...history];
  return copy;
}
