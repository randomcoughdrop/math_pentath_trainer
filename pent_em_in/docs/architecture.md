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

**`constants.js`** holds the fixed facts: the 13 × 9 size, the four star squares, the four chip starting squares, which picture (boot or hat) is printed under each player's starting squares, both color schemes, the per-difficulty rules (`BAND_RULES`), the preset levels, and `bandForLevel()`.

**`state.js`** has `createInitialState()`, which returns a plain object. Chips are copied from the constants so changing the state never changes the constants. Fields for later phases (`pieces`, `history`, `strikes`, and so on) exist already but are empty.

**`renderer.js`** has one public function, `render(canvas, state)`, which:

1. Sizes the canvas to its on-screen size times `devicePixelRatio`, so lines are sharp on high-resolution screens.
2. Draws, in order: background, tinted starting squares, grid, stars, printed boot and hat markers, chips.

Grid lines are exactly one device pixel wide and snapped to pixel centers. Stars are drawn as five-point polygons. The boot and hat are small vector silhouettes printed on the board under the starting squares (part of the board, so they stay visible after a chip moves away). Chips are plain solid discs in the owner's color, drawn slightly smaller than the marker so the picture shows around them. `main.js` redraws whenever the canvas changes size (using `ResizeObserver`).

The renderer never changes the state.

**Checking colors:** add `?colors=yellow-green` to the page address to see the second color scheme.

## Phase 2: Shapes, Transforms, and the Piece Trays

### Shapes (`pieces.js`)

The 12 pentominoes are stored as lists of `[row, col]` cells, named by the letter they resemble: F, I, L, N, P, T, U, V, W, X, Y, Z. `getShapeCells(name)` returns a fresh copy that is safe to change.

### Cells and vertices (`transforms.js`)

A **cell** is `[row, col]`. A **vertex** is a grid corner between cells; vertex `[r, c]` is the top-left corner of cell `[r, c]`. Rotations pivot around vertices.

```
vertex [0,0] +--------+ vertex [0,1]
             | cell   |
             | [0,0]  |
vertex [1,0] +--------+ vertex [1,1]
```

None of the transform functions change the list they are given; each returns a new one.

| Function | What it does |
|----------|--------------|
| `slideCells(cells, dr, dc)` | Moves every cell by `dr` rows and `dc` columns |
| `rotateAboutVertex(cells, pivot, quarterTurns)` | Rotates clockwise by 1, 2, or 3 quarter turns around a vertex |
| `flipOverSide(cells, side)` | Flips over the `"top"`, `"bottom"`, `"left"`, or `"right"` side of the bounding rectangle |
| `externalCorners(cells)` | Lists the vertices where a piece may pivot (see below) |
| `vertexCellCount(cells, vertex)` | How many of the four cells around a vertex belong to the piece |
| `boundingBox(cells)` | Smallest rectangle containing the piece |
| `normalize(cells)` | Shifts a piece to the top-left and puts its cells in reading order |
| `shapeKey(cells)` | A text key for a normalized piece, for comparing and de-duplicating |
| `orientations(cells)` | Every distinct way to turn or flip a piece (8 for most; X has 1, I has 2) |

Rotation is always clockwise in code. Since any multiple of 90° is allowed in one turn, direction doesn't change which positions a player can reach.

### External corners

An **external corner** is a vertex touched by exactly **one** cell of the piece: an outward-pointing corner of the outline. Inner (concave) corners touch three cells and are not external. Here the L pentomino has five external corners (`*`) and one inner corner (`o`):

```
*--*
|  |
|  |
|  |
|  o--*
|     |
*-----*
```

An outline always has exactly four more outward corners than inner corners, which the tests use as a check. Counts: I has 4, L has 5, U has 6, X has 8.

### Flipping over a side

A flip mirrors the piece across the line along one side of its bounding rectangle, like turning a page, so it lands just beyond that side. Dents in the outline are ignored. Flipping a U over its top:

```
XXX
X.X     <- the flipped U lands above
-------- the mirror line (the original's top edge)
X.X
XXX     <- the original U
```

Flipping over a side and then back over the opposite side returns the piece to where it started.

### Drawing pieces and trays (`renderer.js`)

- `render(canvas, state)` now also draws every piece in `state.pieces`: solid squares, faint lines between them, and a heavier outline along the piece's outer edge.
- `renderTray(canvas, state, player)` draws a player's tray: the 12 shapes in a 4 × 3 grid, each centered in its own box with its letter in the corner. Shapes the player no longer has in `state.unusedShapes` are greyed out.
- Both use one shared function to draw a piece, so a piece looks the same on the board and in the tray.
- The page has one tray under the board for each player.
- (A temporary `?demo=pieces` page existed in Phase 2 to check the drawing by eye; it was removed in Phase 3.)

## Phase 3: Placement

**Logic (no drawing, no page):**
- `rules.js`: small checks (on the board? a star? touching an opponent piece along an edge?).
- `analyze.js`: `analyzeMove` reports `{ possible, violations, legal, message }`. *Possible* means on the board and not overlapping a chip or piece; *violations* are rule breaks (`placement-star`, `placement-contact`). `isAllowed` decides what the current difficulty permits; until Phase 6 every level refuses violations.
- `moves.js`: lists every legal placement for a player (unused shapes × orientations × positions).
- `game.js`: `applyMove(state, move)` returns `{ ok: true, state }` with a new state or `{ ok: false, message }`. It never edits the state it is given. After each placement it passes the turn. When both players have placed 5 pieces the phase becomes `"movement"` (the starting player moves first); if the next player has no legal placement, the phase becomes `"gameover"` and the other player wins (`winReason: "placement"`).

**UI (the page):**
- The piece being held, the cursor square, and short notices are not game state. They live in a small `view` object owned by `main.js`: `{ held, hover, notice, announce }`.
- `input.js` has pure helpers (`newHeldPiece`, `rotateHeld`, `flipHeld`, `cellsAt`, `computePreview`) that are unit-tested, and `setupInput`, which attaches pointer, button, and key listeners and changes `view`. A successful placement goes through `onPlace` to `applyMove`.
- The board canvas has a small margin (`BOARD_MARGIN`, 0.25 square) so outlines on the edge aren't clipped; `boardCellFromPoint` accounts for it.
- `renderer.js` draws the ghost and highlights the held shape in the tray; it also exports `boardCellFromPoint` and `trayIndexFromPoint`.
- `ui.js` builds the status sentence and enables or disables the buttons.

Flow: pointer or key event → `input.js` changes `view` (or asks `applyMove` to place) → `main.js` `draw()` → renderer and status.

## To Be Written

- Phase 4: movement rules
- Phase 6: challenge procedure
