// Board size, stars, chip starts, color schemes, and the difficulty rules.

export const COLS = 13;
export const ROWS = 9;

// The rules number rows and columns from 1. The code counts from 0,
// so "row 3, column 3" in the rules is { row: 2, col: 2 } here.

// Sheriff stars: columns 3 and 11 in rows 3 and 7 (rules numbering).
export const STARS = [
  { row: 2, col: 2 },
  { row: 2, col: 10 },
  { row: 6, col: 2 },
  { row: 6, col: 10 },
];

// Starting chip squares. The chips themselves are plain solid discs.
export const CHIP_STARTS = [
  { owner: 1, row: 3, col: 6 }, // rules: row 4, column 7
  { owner: 1, row: 4, col: 5 }, // rules: row 5, column 6
  { owner: 2, row: 4, col: 7 }, // rules: row 5, column 8
  { owner: 2, row: 5, col: 6 }, // rules: row 6, column 7
];

// The "boot and hat" spaces: a picture printed on the board under each starting
// square. Both of a player's squares show the same picture, so one player's
// chips start on boots and the other's on hats. The rules don't say which
// player gets which, so this is cosmetic and easy to swap.
export const START_MARKERS = { 1: "boot", 2: "hat" };

// Colors for each player.
export const COLOR_SCHEMES = {
  "red-blue": {
    1: { name: "Red", fill: "#c0392b", edge: "#7b241c" },
    2: { name: "Blue", fill: "#2471a3", edge: "#154360" },
  },
  "yellow-green": {
    1: { name: "Yellow", fill: "#f1c40f", edge: "#9a7d0a" },
    2: { name: "Green", fill: "#27ae60", edge: "#145a32" },
  },
};

export const BOARD_COLORS = {
  background: "#f4f1e8",
  grid: "#8a8577",
  star: "#e0a800",
  starEdge: "#7a5b00",
};

// What each difficulty band changes. Later phases read these flags.
export const BAND_RULES = {
  easy:   { blockViolations: true,  challenges: false, turnAlertSec: null, clock: { type: "cap",   minutes: 60 } },
  medium: { blockViolations: false, challenges: true,  turnAlertSec: 60,   clock: { type: "cap",   minutes: 60 } },
  hard:   { blockViolations: false, challenges: true,  turnAlertSec: 60,   clock: { type: "chess", minutes: 30 } },
};

// The only place the difficulty dial (0 to 100) is set. Tune these freely.
export const PRESET_LEVELS = { easy: 15, medium: 50, hard: 90 };

// 0-33 is easy, 34-66 is medium, 67-100 is hard.
export function bandForLevel(level) {
  if (level <= 33) return "easy";
  if (level <= 66) return "medium";
  return "hard";
}
