// Turns the difficulty level (0-100) into CPU settings. This is the one dial.

import { bandForLevel } from "../constants.js";

// Straight-line interpolation between these rows:
// [level, randomMoveRate, searchDepth, nearBestRate, thinkingMs, maxDepth].
//   randomMoveRate: plays a random legal move
//   searchDepth:    how many moves ahead it always looks (the minimum)
//   nearBestRate:   (of the rest) plays one of the next-best moves instead of the best
//   thinkingMs:     how long it may think; past searchDepth it keeps looking deeper
//                   while there is time (and a deeper look is expected to fit)
//   maxDepth:       the deepest it will ever look
// At level 100 randomMoveRate and nearBestRate are 0: only the best move is played.
const STRENGTH_TABLE = [
  [0, 1.0, 0, 0.0, 0, 0],
  [25, 0.6, 1, 0.2, 300, 2],
  [50, 0.3, 3, 0.4, 1000, 4],
  [75, 0.1, 5, 0.3, 3500, 10],
  [100, 0.0, 6, 0.0, 5000, 14],
];

// Per band: how often the CPU spots a rule break, and how often it breaks one.
const BAND_BEHAVIOR = {
  easy:   { challengeRate: 0,   illegalMoveRate: 0 },
  medium: { challengeRate: 0.8, illegalMoveRate: 0.03 },
  hard:   { challengeRate: 1,   illegalMoveRate: 0 },
};

function interpolate(level, column) {
  for (let i = 1; i < STRENGTH_TABLE.length; i++) {
    const [high, ...highValues] = STRENGTH_TABLE[i];
    const [low, ...lowValues] = STRENGTH_TABLE[i - 1];
    if (level <= high) {
      const share = (level - low) / (high - low);
      return lowValues[column] + (highValues[column] - lowValues[column]) * share;
    }
  }
  return STRENGTH_TABLE[STRENGTH_TABLE.length - 1][column + 1];
}

// { randomMoveRate, searchDepth, nearBestRate, thinkingMs, maxDepth, challengeRate, illegalMoveRate }
export function cpuParams(level) {
  const clamped = Math.min(100, Math.max(0, Number(level) || 0));
  return {
    level: clamped,
    randomMoveRate: interpolate(clamped, 0),
    searchDepth: Math.round(interpolate(clamped, 1)),
    nearBestRate: interpolate(clamped, 2),
    thinkingMs: Math.round(interpolate(clamped, 3)),
    maxDepth: Math.round(interpolate(clamped, 4)),
    ...BAND_BEHAVIOR[bandForLevel(clamped)],
  };
}
