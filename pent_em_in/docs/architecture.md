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
| `js/history.js` | Saves a snapshot before every move; restores earlier states |
| `js/rules.js` | Small single-purpose rule checks |
| `js/analyze.js` | `analyzeMove()`: possible? which rules broken? |
| `js/moves.js` | Generates legal moves |
| `js/challenges.js` | Challenge categories, outcomes, strikes |
| `js/turn.js` | After-move checks: placement forfeit, entrapment, stuck player |
| `js/challenge-ui.js` | The Challenge button, rule list, choice buttons, strike counter |
| `js/game.js` | Turn flow, phases, win detection |
| `js/clock.js` | Game cap, chess clock, turn alert, pause (pure; told how much time passed) |
| `js/renderer.js` | Draws the state to the canvas |
| `js/input.js` | Mouse, touch, and keyboard to game actions |
| `js/ui.js` | Status text, game-over text, clocks display, buttons, move log |
| `js/menu.js` | The start screen |
| `js/ai/engine.js`, `js/ai/worker.js` | Fast engine for the search; the Web Worker that runs the CPU |
| `js/animation.js` | Move animations: descriptors, easing, progress (pure); the renderer draws the moving piece |
| `js/save.js` | Save format, replay of recorded events, undo counting (pure) |
| `js/storage.js` | Safe `localStorage` wrappers |
| `js/sound.js` | Synthesized sound effects (Web Audio) |
| `js/markdown.js`, `js/howto.js` | Tiny DOM-safe Markdown renderer and the How to play dialog |
| `js/players.js` | Who is human or CPU, and who the game is waiting on |
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
- `analyze.js`: `analyzeMove` reports `{ possible, violations, legal, message }`. *Possible* means on the board and not overlapping a chip or piece; *violations* are rule breaks (`placement-star`, `placement-contact`). `isAllowed` decides what the current difficulty permits; Easy refuses violations, Medium and Hard accept them (Phase 6).
- `moves.js`: lists every legal placement for a player (unused shapes × orientations × positions).
- `game.js`: `applyMove(state, move)` returns `{ ok: true, state }` with a new state or `{ ok: false, message }`. It never edits the state it is given. After each placement it passes the turn. When both players have placed 5 pieces the phase becomes `"movement"` (the starting player moves first); if the next player has no legal placement, the phase becomes `"gameover"` and the other player wins (`winReason: "placement"`).

**UI (the page):**
- The piece being held, the cursor square, and short notices are not game state. They live in a small `view` object owned by `main.js`: `{ held, hover, notice, announce }`.
- `input.js` has pure helpers (`newHeldPiece`, `rotateHeld`, `flipHeld`, `cellsAt`, `computePreview`) that are unit-tested, and `setupInput`, which attaches pointer, button, and key listeners and changes `view`. A successful placement goes through `onPlace` to `applyMove`.
- The board canvas has a small margin (`BOARD_MARGIN`, 0.25 square) so outlines on the edge aren't clipped; `boardCellFromPoint` accounts for it.
- `renderer.js` draws the ghost and highlights the held shape in the tray; it also exports `boardCellFromPoint` and `trayIndexFromPoint`.
- `ui.js` builds the status sentence and enables or disables the buttons.

Flow: pointer or key event → `input.js` changes `view` (or asks `applyMove` to place) → `main.js` `draw()` → renderer and status.

## Phase 4: Movement

**Move objects** (all plain data; `pieceId` and `chipId` come from the state):

| Move | Shape |
|---|---|
| Slide | `{ type: "slide", pieceId, direction: "up"\|"down"\|"left"\|"right", distance }` |
| Rotate | `{ type: "rotate", pieceId, pivot: [row, col], quarterTurns: 1\|2\|3 }` (clockwise, about an external corner) |
| Flip | `{ type: "flip", pieceId, side: "top"\|"bottom"\|"left"\|"right" }` |
| Chip move | `{ type: "chip", chipId, to: { row, col } }` |

**Logic:**
- `rules.js` has `cellsAfterMove` (where a piece's cells end up, or `null` if the move is malformed) and the direction tables.
- `analyze.js`: `analyzePieceMove` and `analyzeChipMove` report `{ possible, violations, legal, message }`, like placements do. Impossible: off the board or landing on a chip or piece. Violations: `slide-blocked`, `star-landing`, `chip-blocked`, `chip-repeat`, `piece-repeat`.
- `moves.js`: `getPossibleMoves(state)` returns `[{ move, analysis }]` for every physically possible move of the current player (including rule-breaking ones); `getLegalMoves(state)` returns just the legal ones as plain moves. `isEntrapped` says whether a piece has no legal move. Moves are generated by trying every slide distance, every corner and turn, every side, and every chip direction and distance, and asking `analyzeMove`, so the rules live in only one place.
- `game.js`: `applyMove` handles movement. It updates the piece or chip, counts the mover's streak (`state.repeat[player]`: the last piece moved and how many turns in a row; chip moves leave it alone), remembers a chip move (`lastWasChipMove`), logs the move in `state.moveLog`, and passes the turn. If the player about to move has all of their pieces entrapped, they lose (`winReason: "entrapment"`). Having no legal move at all is the same thing, since every move is a move of a piece or chip.
- `history.js`: before every move (placements too) a snapshot of the old state, without its own history, is added to the new state's `history`. `restoreSnapshot(state, index)` brings one back. Phase 6 uses this to undo an illegal move.

**UI:**
- `input.js` keeps pure helpers that work out what can be clicked (`slideTargets`, `rotateCorners`, `rotateTurns`, `flipChoices`, `chipTargets`) from the list of legal moves, `movementClick` (selects, picks a pivot, or returns a finished move), and `buildOverlay`, which tells the renderer what to mark. `legalMovesFor(state)` works out the legal moves once per state.
- `renderer.js` draws the selection outline, dots on clickable squares, dots on pivot corners, see-through ghosts, and the ×2 streak badge. `vertexFromPoint` finds the grid corner under a click.
- `ui.js` builds the status line and the move log (a two-column table of piece letters, `logCell`, with the full sentence from `describeEntry` as hover text) and shows or hides the placement and movement buttons. The piece trays are hidden once placement is over.

## Phase 5: Endings, Clocks, and the Start Screen

**Ways a game ends** (`state.phase` becomes `"gameover"`; `winner` is 1, 2, or `null` for a tie):

| `winReason` | When | Winner |
|---|---|---|
| `"placement"` | A player has no legal placement left (Phase 3) | The other player |
| `"entrapment"` | All of the player-to-move's pieces have no legal move (Phase 4) | The other player |
| `"time"` with a winner | A player's chess clock reached zero (Hard) | The other player |
| `"time"` with `winner: null` | The game cap ran out and nobody won (Easy, Medium) | Tie |

**Clocks live outside the rules.** `clock.js` holds a plain clock object (`createClock(level)`) and functions that are *told* how much time has passed (`advanceClock(clock, ms, player)`), so nothing in it waits on a real timer and it can be tested instantly. It reports what happened: `{ capReached, flagFall, turnAlert }`. `main.js` runs a timer a few times a second, measures real elapsed time (never more than 10 seconds per tick, so a sleeping computer doesn't burn a clock), and passes it in. The clock's type comes from `BAND_RULES` through `bandForLevel(level)`.

**When time is up the page tells the game**, with two functions in `game.js`:
- `callTime(state)` (game cap): sets `timeCalled` and `timeEndsAfter`. The player on the move finishes their turn. If they are the player who moved first in the game, the other player gets one more turn so both have equal turns. After that turn `applyMove` ends the game as a tie, unless a win by the rules happened first (that takes priority).
- `loseOnTime(state, player)` (chess clock): that player loses.

**Pausing** is page-only: `view.paused` stops the clock (`setPaused`) and hides the board and controls, so the position can't be studied while the clocks are stopped.

**The start screen** (`menu.js`) turns radio-button choices into settings (`settingsFromChoices`), and `main.js` `startGame` builds the state and clock from them. "Play again" starts a new game with the same settings; "Back to menu" returns to the start screen.

## Phase 9: Deep Search and the Worker

`ai/engine.js` is a fast copy of the movement rules for the search to run on, `ai/search.js` has the minimax search, and `ai/worker.js` runs the computer's thinking in a Web Worker. `main.js` sends the worker the game state (without its saved history) and plays whatever move comes back after at least half a second; if workers aren't available it thinks on the main thread. See [ai.md](ai.md).

## Phase 8: Evaluation and Search

`ai/mobility.js` lists legal moves quickly and builds cheap "what if" positions; `ai/evaluate.js` scores a position by freedom to move; `ai/search.js` looks one move ahead. `ai/cpu.js` uses them for movement, placement, and the choices after a challenge. Details and weights are in [ai.md](ai.md).

## Phase 7: The Computer

- `players.js` says who controls each player (`state.settings.players`) and who the game is waiting on (`actorNow`). `input.js`, `challenge-ui.js`, and `ui.js` use `cpuToAct` to ignore clicks and show "thinking" while the computer acts.
- `ai/` holds the CPU (see [ai.md](ai.md)). It returns moves; `main.js` `scheduleCpu` plays them after a delay through the same `applyMove` a person uses.
- `copyState` now shares the saved snapshots in `history` instead of cloning them all (they are never changed). Before this, every move got slower as the game went on, which a long CPU game made obvious.

## Phase 6: Rule-Breaking Moves and Challenges

- `rules.js`: `bandRulesFor(state)` reads `BAND_RULES`; `blocksViolations` is true only on Easy; `challengesEnabled` is true on Medium and Hard. Impossible moves (off the board, overlaps) are always refused.
- `moves.js`: `getAllowedMoves` is what the player may attempt at this level (every possible move on Medium and Hard, only legal ones on Easy). `getLegalMoves` is still the strictly legal set, used for entrapment checks.
- Every accepted move stores `state.lastTurn = { player, move, violations }`.
- `challenges.js` is a small state machine. `challenge()` either ends the game (three in a row, three strikes) or sets `state.pending`:
  - `choose` (after a movement rule): the chooser picks from `options` via a `decide` move.
  - `place-for` (correct placement challenge): the challenger places one of the offender's shapes with a normal `place` move.
  - `move-chip` (incorrect placement challenge): the challenged player moves one of the challenger's chips with `relocate-chip`.
  While `pending` is set, `applyMove` accepts only the matching move type. `restoreBeforeLastMove` uses `history.js` but keeps the strikes, the log, and the time-called flags.
- `mustMovePiece` is set by a "force a pentomino move" choice; chip moves are refused until a piece moves.
- `challengeWin` handles the once-only challenge of a forfeit or entrapment win.
- `turn.js` holds the forfeit, entrapment, and stuck-player checks that run after any turn change.
- UI: `challenge-ui.js` shows and hides the parts; `input.js` `placementOwner` says whose tray is active (the challenger while placing for the opponent) and `relocationClick` handles picking a chip then a square.

## Phase 10: Polish

- **Animations.** `playMove` builds an animation from the position before the move (`createAnimation`) and the main loop redraws with `requestAnimationFrame` until it finishes. The game state is already the final position; the renderer just draws the moving piece (or chip) with a canvas transform from where it started and skips it in the normal pass.
- **Save, resume, undo.** `main.js` keeps `events` (every move, plus `@time` and `@flag`). A save is settings + first player + events + clock; `replayEvents` rebuilds the state. Undo replays all but the last events (`undoCount`).
- **Patterns.** A renderer flag hatches Player 2's pieces.
- **How to play.** `docs/rules.md` is fetched and rendered up to its first "Implementation notes" heading.
