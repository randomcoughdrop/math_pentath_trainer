# Architecture

How the code is organized. This file grows with each phase (see `../DEVELOPMENT_PLAN.md`).

## Big Idea

- **Logic and drawing are separate.** Game rules never touch the canvas or the page. The renderer only reads the game state and draws it.
- **State is plain data.** The game state is an ordinary object. Functions take a state and return a new state, or a list of legal moves.
- **One place to look up a rule.** `analyzeMove(state, move)` reports whether a move is possible and which rules it breaks.
- **Clocks live outside the rules.** The UI owns the timers and tells the game when time is up.

## File Map

| File | Job |
|------|-----|
| `js/main.js` | Entry point; wires everything together |
| `js/constants.js` | Board size, stars, chip starts, colors, difficulty rules |
| `js/pieces.js` | The 12 pentomino shapes |
| `js/transforms.js` | Slide, rotate, and flip math |
| `js/state.js` | Creates and copies the game state |
| `js/history.js` | Saves and restores earlier states |
| `js/rules.js` | Small single-purpose rule checks |
| `js/analyze.js` | `analyzeMove()`: possible? which rules broken? |
| `js/moves.js` | Generates legal moves |
| `js/challenges.js` | Challenge categories, outcomes, strikes |
| `js/game.js` | Turn flow, phases, win detection |
| `js/clock.js` | Game cap, chess clock, turn alert, pause |
| `js/renderer.js` | Draws the state to the canvas |
| `js/input.js` | Mouse, touch, and keyboard to game actions |
| `js/ui.js` | Status text, buttons, menus |
| `js/ai/` | The CPU (parameters, move choice, evaluation, search, worker) |

## Coordinates

The rules number rows and columns from 1; the code counts from 0. "Row 4, column 7" in the rules is `{ row: 3, col: 6 }` in code. Constants carry a comment with the rules numbering next to each value.

## Phase 1: Constants, State, and Drawing

**`constants.js`** holds the fixed facts: the 13 × 9 size, the four star squares, the four chip starting squares, both color schemes, the per-difficulty rules (`BAND_RULES`), the preset levels, and `bandForLevel()`.

**`state.js`** has `createInitialState()`, which returns a plain object. Chips are copied from the constants so changing the state never changes the constants. Fields for later phases (`pieces`, `history`, `strikes`, and so on) exist already but are empty.

**`renderer.js`** has one public function, `render(canvas, state)`, which:

1. Sizes the canvas to its on-screen size times `devicePixelRatio`, so lines are sharp on high-resolution screens.
2. Draws, in order: background, tinted boot-and-hat squares, grid, stars, chips.

Grid lines are exactly one device pixel wide and snapped to pixel centers. Stars are drawn as five-point polygons, and boot and hat are small vector silhouettes on a round chip. `main.js` redraws whenever the canvas changes size (using `ResizeObserver`).

The renderer never changes the state.

**Checking colors:** add `?colors=yellow-green` to the page address to see the second color scheme.

## To Be Written

- Phase 2: shapes and transform helpers, with diagrams of "external corner" and "flip over a side"
- Phase 4: movement rules
- Phase 6: challenge procedure
