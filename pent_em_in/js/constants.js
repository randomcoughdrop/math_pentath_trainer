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

// Starting chip squares ("boot and hat" spaces). Chip A is drawn as a boot
// and chip B as a hat; the rules don't say which is which, so this is cosmetic.
export const CHIP_STARTS = [
  { owner: 1, kind: "boot", row: 3, col: 6 }, // rules: row 4, column 7
  { owner: 1, kind: "hat", row: 4, col: 5 },  // rules: row 5, column 6
  { owner: 2, kind: "boot", row: 4, col: 7 }, // rules: row 5, column 8
  { owner: 2, kind: "hat", row: 5, col: 6 },  // rules: row 6, column 7
];

// Colors for each player. "icon" is the color of the boot/hat drawn on a chip.
export const COLOR_SCHEMES = {
  "red-blue": {
    1: { name: "Red", fill: "#c0392b", edge: "#7b241c", icon: "#ffffff" },
    2: { name: "Blue", fill: "#2471a3", edge: "#154360", icon: "#ffffff" },
  },
  "yellow-green": {
    1: { name: "Yellow", fill: "#f1c40f", edge: "#9a7d0a", icon: "#3b3000" },
    2: { name: "Green", fill: "#27ae60", edge: "#145a32", icon: "#ffffff" },
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
