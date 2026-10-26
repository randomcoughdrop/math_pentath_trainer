# Pent 'Em In: Development Plan

A phased plan for building Pent 'Em In as a browser game on an HTML canvas, with **Player vs Player** (same screen) and **Player vs CPU** modes. One **difficulty scale** controls how strictly the rules are enforced, which clocks run, and how strong the CPU is. Rules reference: `docs/rules.md` (the tournament rules summary).

Each phase ends with something playable or testable, so the game grows a little at a time and nothing is left half-built for long.

---

## Guiding Principles

1. **Logic and drawing are kept apart.** Game rules never touch the canvas or the DOM. The renderer only reads state and draws it. This keeps the rules testable and lets the CPU "imagine" moves without drawing anything.
2. **State is plain data.** The game state is a simple object (board size, pieces, chips, whose turn, phase). Functions take a state and return a new state or a list of legal moves.
3. **Small files, one job each.** Aim for under about 200 lines per file. If a file needs a long header comment to explain it, split it.
4. **Plain JavaScript, no build step.** ES modules (`<script type="module">`) and no frameworks, so GitHub Pages serves the files as-is.
5. **Readable over clever.** Descriptive names, short functions, comments that explain *why*, not *what*.
6. **Docs move with the code.** Each phase finishes by updating the docs listed under it.
7. **Clocks live outside the rules.** Game logic never reads the system clock. The UI owns the timers and tells the game when time is up, which keeps the rules deterministic and testable.
8. **One place to look up a rule.** Every move is checked by a single function that reports whether it is *possible* and which rules it *breaks*. Easy mode refuses rule-breaking moves; Medium and Hard accept them and leave them to be challenged.

---

## Confirmed Rules Decisions

These are settled and should be copied into `docs/decisions.md` in Phase 0.

| Topic | Decision |
|-------|----------|
| Piece choice | Each player has their **own** pool of all 12 free pentominoes and chooses 5. Both players may choose the same shape. |
| Player colors | Two physical sets exist: red/blue or yellow/green. The game offers both color schemes. |
| Boot and hat | The four chip starting squares: (row 4, col 7) and (row 5, col 6) for Player 1; (row 5, col 8) and (row 6, col 7) for Player 2. They are ordinary squares once vacated, so pieces may move into or through them when unoccupied. |
| Placement order | The starting player places first, then players alternate one piece at a time. |
| Slide | Orthogonal only (up, down, left, right), any distance, as long as the whole path is unblocked (no chips, pieces, or stars). |
| Rotate | Around **any external corner** of the piece, by any multiple of 90° (90°, 180°, or 270°) in a single turn. May sweep over chips, stars, and pieces. |
| Flip | Mirror across a line along the **top, bottom, left, or right side of the piece's bounding rectangle**. Edges inside notches (such as the inside of the U) do not count. May sweep over chips, stars, and pieces. |
| Chip move | Moves like a **queen in chess**: any distance in any of 8 directions, but it cannot pass through an occupied square and cannot slide through or land on a star. |
| Entrapped | A pentomino is entrapped when it has **no valid move** (no legal slide, rotation, or flip). Chips and all pieces, including the owner's own, count as obstacles. |
| Win | Entrap all 5 opposing pieces, opponent cannot place all 5, opponent has no legal move, opponent is correctly challenged for moving the same piece three turns in a row, opponent reaches three incorrect challenges, or (Hard) opponent's chess clock runs out. |
| Tie | The 60-minute game cap is reached with no winner (Easy and Medium). |
| Rule-breaking categories | Six challengeable categories (see the challenge table below). Stars and passing over occupied squares are rule-breaking but possible; only off-board or overlapping landings are impossible. |
| Placement challenge | A correct challenge removes the piece, the challenger places one of the opponent's shapes for them, then takes their own turn. An incorrect one lets the challenged player move one of the challenger's chips. |
| Chess clock (Hard) | 30 minutes per player, no increment, running out of time loses. The 60-second turn alert still applies. |
| Difficulty control | Players see only the Easy / Medium / Hard presets. The underlying `level` number is set in code through `PRESET_LEVELS`. |
| CPU starting values | The `randomMoveRate` / `searchDepth` table is the starting point and is tuned by playing. |

### Two kinds of "not allowed"

Every attempted move falls into one of two groups:

- **Impossible moves** can never happen on any level: any part of a piece landing **off the board** or **on top of a chip or another piece**. The interface always refuses these.
- **Rule-breaking moves** are physically possible but against the rules (listed in the challenge table below). **Easy** refuses them. **Medium and Hard** accept them, and the opponent must spot and **challenge** them or they stand.

### Difficulty Scale (one dial)

A single number, `level` from 0 to 100, drives everything. It is split into three named bands. Players only see three preset buttons (Easy, Medium, Hard); the number itself is an "under the hood" setting you adjust in `constants.js`, not a control in the interface.

| | **Easy** (0–33) | **Medium** (34–66) | **Hard** (67–100) |
|---|---|---|---|
| Rule-breaking moves by players | Refused | Allowed; must be challenged | Allowed; must be challenged |
| Challenge button | Hidden | Always available at the start of a turn | Always available at the start of a turn |
| Three incorrect challenges | n/a | Loses the game | Loses the game |
| CPU rule-breaking moves | Never | Rarely (about 3% of turns) | Never |
| CPU challenges your rule-breaking moves | n/a | Most (about 80%) | All |
| Turn timer | None | 60-second soft alert | 60-second soft alert |
| Game clock | 60-minute cap, ends in a tie | 60-minute cap, ends in a tie | **30-minute chess clock per player**; running out of time loses |

The CPU never makes a *false* challenge on any level.

**CPU strength comes from the same dial.** Two numbers are computed from `level` and are the only things that change how the CPU picks a move:

- `randomMoveRate`: the chance the CPU plays a random legal move instead of its best one (falls as `level` rises)
- `searchDepth`: how many moves ahead it looks (rises as `level` rises; 0 means no lookahead)

Starting values to tune by playing, with straight-line interpolation between rows:

| level | randomMoveRate | searchDepth |
|-------|----------------|-------------|
| 0 | 100% | 0 |
| 25 | 60% | 1 |
| 50 | 30% | 2 |
| 75 | 10% | 3 |
| 100 | 0% | 4 (limited by a time budget) |

Each preset button sets `level` to a value defined in `PRESET_LEVELS` (starting values: Easy = 15, Medium = 50, Hard = 90). Change those numbers, or the table above, to retune the CPU without touching any other code. In Player vs Player only the band matters (rules and clocks); the CPU numbers are ignored.

To keep Medium and Hard fair, the game always shows a small streak badge (for example "×2") on a piece that has been moved twice in a row, so the repetition rule stays visible.

### Working definitions

- **External corner:** a grid vertex where exactly **one** of the four surrounding cells belongs to the piece. These are the convex corners of the piece's outline; concave (inner) corners are excluded.
- **Flip sides:** the four sides of the piece's bounding rectangle. Every piece therefore has exactly four flips (one over each side).
- **Consecutive chip moves:** a player's chip move followed by a chip move on that player's very next turn.
- **Stars:** a star square is a rule, not an obstacle that blocks movement physically. Landing on or passing over one is a rule-breaking move, not an impossible one.

### Rule-breaking moves and challenge categories

| Category | Rule broken | Kind |
|----------|-------------|------|
| `placement-star` | A piece was placed on a star | Placement |
| `placement-contact` | A piece was placed sharing an edge with an opponent's piece | Placement |
| `slide-blocked` | A slide passed over a chip, piece, or star | Other |
| `chip-blocked` | A chip passed over an occupied square, or passed over or landed on a star | Other |
| `chip-repeat` | Two chip moves in a row | Other |
| `piece-repeat` | The same piece moved three turns in a row (chip moves in between don't break the streak) | Three-in-a-row |

When a move is made, the game records which categories it broke (hidden from the players). A challenge simply compares the category the challenger names against that record.

### Challenge procedure (Medium and Hard)

Adapted from the tournament rules so the computer takes the role of the Game Monitor:

- The **Challenge** button is available at the **start** of a turn, before anything has been selected or moved (it is disabled on the very first turn of the game, when there is nothing to challenge). It always targets the opponent's most recent turn, and a violation that is not challenged right away stands.
- The challenger **names the rule** from the category list. If a turn broke several rules, each is its own separate challenge.

| Challenge | If correct (recorded "C") | If incorrect (recorded "I") |
|-----------|---------------------------|------------------------------|
| **Placement** (`placement-*`) | The opponent's piece is removed. The challenger chooses one of the opponent's remaining shapes and places it legally for them (using up one of their 5 pieces). The challenger then takes their own turn. | The challenged player may move one of the challenger's chips to a new location. The challenger then takes their own turn. |
| **Other** (`slide-blocked`, `chip-blocked`, `chip-repeat`) | The board is restored to before the illegal move. The challenger chooses either to **take a turn** or to **force the opponent to move a pentomino**. | The challenged player chooses either to make the challenger **lose the turn** or to **force the challenger to move a pentomino**. |
| **Three-in-a-row** (`piece-repeat`) | The challenger **wins the game**. | Same as "Other." |

- **Three incorrect challenges** is an automatic loss.
- The CPU challenges according to its rate for the current band (see the difficulty table).

### Time

- **Easy and Medium: game cap.** 60 minutes of active play. When time is called, the current turn is completed. If the player who had the move is the one who moved first in the game, the other player gets one more turn so both have equal turns. If nobody has won, the game is a tie.
- **Hard: chess clock.** Each player starts with 30 minutes. A player's clock runs during their own turn and stops when they finish it. A player whose clock reaches zero loses. No increment.
- **Turn alert (Medium and Hard).** A soft alert after 60 seconds on a turn. It is a reminder only, with no forfeit (Pent 'Em In is exempt from the turn-forfeit rule). It applies to human turns, not CPU turns.
- **Pausing.** Allowed on every level. Paused time counts toward neither clock, and the board is hidden while paused so a pause can't be used to think.

---

## Digital Adaptations

| On paper | In the game |
|----------|-------------|
| Game Monitor hides a chip in each hand to pick who starts | Random starting player (shown with a short message) |
| Movement Record Flag Card | Automatic move log in a side panel |
| Challenges (I / IA / C) | A Challenge button with a rule list on Medium and Hard; "IA" never happens because the button only works at the right time |
| Game Monitor restores the board | The game keeps a history of states and rolls back |
| Game Monitor spots forfeits | The game checks for "cannot place" and "no legal move" automatically, using rule-correct moves on every level |
| One-minute turn limit | Soft alert only on Medium and Hard |
| Time called | 60-minute cap with the equal-turns rule (Easy, Medium) or a 30-minute chess clock (Hard) |
| Declaring a win | Automatic |

---

## Proposed File Structure

```
pent_em_in/
├── index.html              # Page shell: canvas, buttons, script tag
├── README.md               # What the game is, how to run it, how to play
├── DEVELOPMENT_PLAN.md     # This file
├── css/
│   └── style.css           # Page layout and buttons (not the canvas drawing)
├── js/
│   ├── main.js             # Entry point: wires everything together
│   ├── constants.js        # Board size, stars, chip starts, color schemes, band rules
│   ├── pieces.js           # The 12 pentomino shapes + piece helpers
│   ├── transforms.js       # Slide, rotate-about-corner, and flip math on cell lists
│   ├── state.js            # Creates and copies the game state
│   ├── history.js          # Saves and restores earlier states (for challenges, undo)
│   ├── rules.js            # Small single-purpose rule checks (pure logic)
│   ├── analyze.js          # analyzeMove(): is it possible, and which rules does it break?
│   ├── moves.js            # Generates legal moves, and rule-breaking-but-possible moves
│   ├── challenges.js       # Challenge categories, outcomes, and strikes
│   ├── game.js             # Turn flow, phases, win detection
│   ├── clock.js            # Game cap, chess clock, turn alert, pause (UI side)
│   ├── renderer.js         # Draws state to the canvas
│   ├── input.js            # Mouse/touch/keyboard to game actions
│   ├── ui.js               # Status text, buttons, menus (DOM, not canvas)
│   └── ai/
│       ├── params.js       # level (0-100) -> randomMoveRate, searchDepth, challengeRate, illegalRate
│       ├── cpu.js          # Entry point: chooseMove(), shouldChallenge()
│       ├── evaluate.js     # Scores a position
│       ├── search.js       # Minimax with alpha-beta
│       └── worker.js       # Runs the search off the main thread
├── tests/
│   └── tests.html          # Opens in a browser, runs simple assert-based tests
└── docs/
    ├── rules.md            # Rules summary (the reference you already have)
    ├── architecture.md     # How the files fit together
    ├── ai.md               # How the CPU thinks and how the dial works
    └── decisions.md        # Rule ambiguities and how we resolved them
```

> **Local testing note:** ES modules don't load from `file://`. Run `python3 -m http.server` inside the repo folder and open `http://localhost:8000/pent_em_in/`.

---

## Core Data Model (decide early, keep stable)

The band rules live in one place so every rule check reads from it:

```js
// constants.js
export const BAND_RULES = {
  easy:   { blockViolations: true,  challenges: false, turnAlertSec: null, clock: { type: "cap",   minutes: 60 } },
  medium: { blockViolations: false, challenges: true,  turnAlertSec: 60,   clock: { type: "cap",   minutes: 60 } },
  hard:   { blockViolations: false, challenges: true,  turnAlertSec: 60,   clock: { type: "chess", minutes: 30 } },
};
export function bandForLevel(level) { /* 0-33 easy, 34-66 medium, 67-100 hard */ }
export const PRESET_LEVELS = { easy: 15, medium: 50, hard: 90 };   // the only place the dial is set
```

```js
state = {
  phase: "placement" | "movement" | "gameover",
  currentPlayer: 1 | 2,
  startingPlayer: 1 | 2,
  settings: { level: 0-100, colorScheme: "red-blue" | "yellow-green" },
  pieces: [ { id, owner, shape: "F", cells: [[row, col], ...] }, ... ],
  chips:  [ { id, owner, row, col }, ... ],
  unusedShapes: { 1: ["F","I",...], 2: ["F","I",...] },  // each player starts with all 12
  placedCount: { 1: 0, 2: 0 },
  repeat: { 1: { pieceId: null, count: 0 }, 2: { pieceId: null, count: 0 } },
  lastWasChipMove: { 1: false, 2: false },
  lastTurn: { player, move, violations: [ "chip-repeat", ... ] },  // hidden until challenged
  strikes: { 1: 0, 2: 0 },          // incorrect challenges
  history: [ ...earlier states... ],
  moveLog: [ ...moves and challenges... ],
  winner: null | 1 | 2 | "tie",
  winReason: null | "entrapment" | "placement" | "no-moves" | "repetition" | "strikes" | "time" | "cap"
}
```

A **move** is plain data:

```js
{ type: "place",     shape: "F", cells: [[r, c], ...] }
{ type: "slide",     pieceId, dr, dc }                           // orthogonal, any distance
{ type: "rotate",    pieceId, pivot: [vr, vc], quarterTurns }    // quarterTurns: 1, 2, or 3
{ type: "flip",      pieceId, side: "top" | "bottom" | "left" | "right" }
{ type: "chip",      chipId, toRow, toCol }                      // queen move; path is derived
{ type: "challenge", category: "chip-repeat" }                   // Medium and Hard only
```

The key function that ties the rules together:

```js
analyzeMove(state, move) → { possible: true | false, violations: [ ...category names... ] }
```

- `possible` is false for off-board or overlapping landings (never allowed).
- `violations` lists the rule-breaking categories (empty means a fully legal move).
- On Easy the game plays only moves with no violations. On Medium and Hard it plays any possible move and stores `violations` in `lastTurn`.

Pivots live on grid **vertices** (between cells), not on cells, so the rotation math stays in `transforms.js` and is easy to test.

---

## Phases

### Phase 0: Project Scaffolding and Docs
**Goal:** An empty but well-organized project that loads without errors.

- Create the folder structure above (empty files are fine).
- `index.html` with a `<canvas>`, a status line, and `<script type="module" src="js/main.js">`.
- `css/style.css` with basic centering and a responsive canvas wrapper.
- `main.js` logs "Pent 'Em In loaded".
- Copy the rules summary into `docs/rules.md`.
- Create `docs/decisions.md` from the "Confirmed Rules Decisions" and difficulty tables.
- Write a first `README.md`.

**Done when:** The page loads locally and on GitHub Pages with no console errors.
**Docs:** README (run instructions), `docs/decisions.md`.

---

### Phase 1: Draw the Board
**Goal:** See the empty 13 × 9 board with stars and chips.

- `constants.js`: `COLS = 13`, `ROWS = 9`, star squares (columns 3 and 11 in rows 3 and 7), the four chip start squares, both color schemes, and `BAND_RULES`.
- `renderer.js`: `drawBoard(ctx, state)` draws grid lines, star squares, and chips.
- Chips are drawn as a **boot** and a **hat** for each player (simple vector shapes; a letter label is an acceptable placeholder).
- Compute cell size from canvas width; handle high-DPI screens (`devicePixelRatio`) so lines are crisp.

**Done when:** The board matches the official layout, resizes cleanly, and looks sharp on phone and desktop.
**Docs:** `docs/architecture.md` first draft (state, renderer, constants).

---

### Phase 2: Pentomino Data and Transforms
**Goal:** All 12 pieces exist as data, can be transformed, and can be drawn.

- `pieces.js`: the 12 free pentominoes (F, I, L, N, P, T, U, V, W, X, Y, Z) as `[row, col]` offsets.
- `transforms.js`:
  - `slideCells(cells, dr, dc)`
  - `rotateAboutVertex(cells, pivot, quarterTurns)`
  - `flipOverSide(cells, side)`: mirrors across the bounding-rectangle side named `"top"`, `"bottom"`, `"left"`, or `"right"`
  - `externalCorners(cells)`: every vertex touched by exactly one of the piece's cells
  - `boundingBox(cells)` and `normalize(cells)`: for flips, comparing shapes, and the tray display
- `renderer.js`: `drawPieces` draws each piece's cells in its owner's color.
- Piece trays below the board (one per player) showing the 12 shapes, with used ones greyed out.
- A temporary `js/demo.js` (page address `?demo=pieces`) places sample pieces so the drawing can be checked by eye; it is removed in Phase 3.
- First tests in `tests/tests.html`:
  - every shape has exactly 5 cells
  - four quarter-turns return the original cells
  - flipping over the top and then over the new bottom returns the original
  - `externalCorners` returns the expected count for easy cases (I has 4, L has 5, U has 6, X has 8), and every shape has exactly four more outward corners than inner corners
  - flips ignore notches (the U flips over its four bounding sides only)

**Done when:** You can see all 12 pieces in the tray and the tests pass.
**Docs:** Add shapes and transform helpers to `architecture.md`, with a small diagram of "external corner" and "flip over a side."

---

### Phase 3: Placement Phase (Player vs Player)
**Goal:** Two people take turns choosing and placing 5 pieces each.

- `state.js`: `createInitialState()` with each player's `unusedShapes` set to all 12 and a randomly chosen starting player.
- `rules.js` and `analyze.js`: `analyzeMove` for placements.
  - **Impossible:** a cell is off the board, or on a chip or another piece.
  - **Violations:** `placement-star` (a cell on a star) and `placement-contact` (an edge shared with an opponent's piece).
- For now the game plays Easy rules only (any violation is refused with a clear message). Medium and Hard behavior arrives in Phase 6.
- `input.js`: click a tray piece to select it, rotate and flip it freely with `R` and `F` (or on-screen buttons) *before* placing, hover shows a green/red ghost preview, click to place. Placed pieces are final.
- `game.js`: `applyMove` for placements, alternating turns (starting player first), stop at 5 pieces each.
- **Forfeit check:** if none of a player's unused shapes has any rule-legal placement anywhere, that player loses (`winReason: "placement"`). This applies on every level.
- `ui.js`: status line ("Player 2: place a piece, 3 left").
- Tests: one hand-built placement for every impossible case and each violation.

**Done when:** Both players can place 5 pieces, invalid placements are refused with a clear reason, and the game moves to the movement phase automatically.
**Docs:** Update README with controls; mark placement rules implemented in `rules.md`.

---

### Phase 4: Movement Phase (Player vs Player, Easy rules)
**Goal:** Players take turns sliding, rotating, and flipping pieces and moving chips, with every rule strictly enforced.

- `rules.js` and `analyze.js`: `analyzeMove` for movement.
  - **Impossible:** off the board, or landing on a chip or piece.
  - **Slide:** orthogonal, any distance of 1 or more squares. Passing over a chip, piece, or star is `slide-blocked`.
  - **Rotate:** about any external corner, by 90°, 180°, or 270°. Sweeping over obstacles is fine; only the landing squares matter.
  - **Flip:** over the top, bottom, left, or right side. Same landing rules as rotate.
  - **Chip move:** queen-style. Passing over an occupied square, or passing over or landing on a star, is `chip-blocked`. Moving a chip on two consecutive turns is `chip-repeat`.
  - **Repetition:** a third consecutive move of the same piece is `piece-repeat`.
  - **One action per turn:** the interface only allows one slide, rotate, or flip per turn.
- `moves.js`: `getLegalMoves(state)` returns every move with no violations. Used by the UI (highlighting) and later by the CPU. Also add `getPossibleMoves(state)` (violations allowed) for later.
- `input.js`: click a piece, then pick an action:
  - slide: click a highlighted destination along a line
  - rotate: click one of the piece's highlighted external corners, then choose 90°, 180°, or 270°
  - flip: click one of the four highlighted sides
  - chip: click a chip, then click a highlighted destination
- **Streak badge** on any piece moved twice in a row.
- Side panel move log (the digital Movement Record Flag Card).
- `history.js`: save a snapshot of the state before every move (needed by Phase 6).
- Tests: every violation category, plus entrapment examples such as a piece boxed into a corner by chips.

**Done when:** Two players can play a full movement phase with all restrictions enforced and a visible move log.
**Docs:** Movement rules section in `architecture.md`; update `decisions.md`.

---

### Phase 5: Difficulty Scale, Win Conditions, and Clocks
**Goal:** Games actually end, correctly, and the difficulty scale starts working.

- `game.js`: after every move, check the win conditions:
  1. **Entrapment:** all 5 of the opponent's pieces have no valid move (reuses `getLegalMoves` filtered by piece)
  2. **Placement:** the opponent cannot place all 5 pieces (from Phase 3)
  3. **No legal move:** the player to move has nothing legal to do
- Game-over overlay with the winner and reason; "Play again" and "Back to menu" buttons.
- Start screen: choose **2 Players** (the CPU option is greyed out until Phase 7), a **difficulty** (three preset buttons: Easy, Medium, Hard), and a color scheme. `bandForLevel` and `BAND_RULES` wire the setting into the rules, but until Phase 6 only Easy behavior is active, so the other bands behave like Easy.
- `clock.js`:
  - 60-minute game cap on Easy and Medium: on expiry, `game.js` applies the equal-turns rule and declares a tie if nobody has won
  - 30-minute chess clock per player on Hard: running out of time loses (`winReason: "time"`)
  - 60-second soft turn alert on Medium and Hard (visual flash plus an optional sound; no penalty)
  - pause button that stops all clocks and hides the board
  - visible clocks in the side panel
- Tests for each win condition using hand-built states, and for time-up handling by calling the game's time-up functions directly (no real waiting).

**Done when:** Every win condition is reachable and tested, the clocks behave correctly, and a full PvP game can be played from menu to game over.
**Docs:** README "How to play" and the difficulty table; `rules.md` implementation notes.

---

### Phase 6: Rule-Breaking Moves and Challenges (Medium and Hard)
**Goal:** On Medium and Hard, rule-breaking moves are allowed and the opponent can challenge them.

- `analyze.js` and `game.js`: on Medium and Hard, accept any *possible* move and store its `violations` in `state.lastTurn`. Easy still refuses violations.
- `challenges.js`:
  - `canChallenge(state)`: true at the start of a turn when challenges are enabled and there is a previous turn
  - `resolveChallenge(state, category, choice)`: correct or incorrect per the "Challenge procedure" table, using `history.js` to restore the board
  - `piece-repeat` correct challenge: the challenger wins immediately
  - strike tracking and the three-incorrect-challenges loss (`winReason: "strikes"`)
- UI: a **Challenge** button visible at the start of every turn on Medium and Hard. Clicking it opens the list of rule categories, then any follow-up choice dialog ("Take a turn" or "Force a pentomino move" for a correct challenge; the challenged player's choice for an incorrect one; "Place a piece for the opponent" for a correct placement challenge).
- Challenges, results, and strikes appear in the move log.
- Tests: for each category, a correct challenge restores the exact earlier state, an incorrect one adds a strike, three strikes loses, an unchallenged violation stands, and the button is absent on Easy.

**Done when:** A two-player Medium or Hard game can include each kind of violation, a challenge, and each outcome path, all covered by tests.
**Docs:** Challenge procedure section in `rules.md` and `architecture.md`.

---

### Phase 7: CPU Foundation and the Difficulty Dial
**Goal:** Single-player mode exists, driven by the unified `level` number, even if the CPU's play is still random.

- `ai/params.js`: `cpuParams(level)` returns `{ randomMoveRate, searchDepth, challengeRate, illegalMoveRate }`. The first two interpolate along the table in "Difficulty Scale"; the last two come from the band (challenge: Easy none, Medium about 0.8, Hard 1.0; illegal-move: Easy 0, Medium about 0.03, Hard 0).
- `ai/cpu.js`: `chooseMove(state, params)`:
  1. with probability `illegalMoveRate`, pick a random *possible* move that breaks a rule (if one exists)
  2. otherwise with probability `randomMoveRate`, pick a random legal move
  3. otherwise use the search (a stub that picks randomly until Phase 8)
  
  and `shouldChallenge(state, params)`: challenges the human's last turn only if it really broke a rule, and only with probability `challengeRate`.
- Placement: random shape, orientation, and position from the legal placements.
- `main.js`: each player is `"human"` or `"cpu"`, so adding CPU logic later does not touch game logic.
- Short artificial delay (about 500 ms) so CPU moves are visible; highlight the last move.
- Menu: **Player vs CPU** option, who goes first, and the difficulty presets now set the CPU's numbers through `PRESET_LEVELS`.

**Done when:** You can play a full game against the CPU at each of the three presets (and at other `level` values set in code) with no crashes, and on Medium it occasionally breaks a rule and occasionally challenges you.
**Docs:** Create `docs/ai.md` with the CPU interface, the `cpuParams` table, and the "one dial" explanation.

---

### Phase 8: CPU Evaluation and Shallow Search
**Goal:** A CPU that plays sensibly when it is not picking randomly.

- `ai/evaluate.js`: score a position from a player's point of view. Start simple, tune later:
  - own legal-move count minus the opponent's legal-move count (mobility)
  - number of opponent pieces with only one or two valid moves left
  - penalty for own pieces with very few valid moves
  - heavy penalty for any position where its own third consecutive move of a piece would be needed
- `ai/search.js`: search depth 1 (try each move, evaluate the result, take the best, with ties broken randomly).
- **Placement strategy:** the CPU chooses *which* 5 shapes to use, so it can favor shapes with many external corners and flexible movement, and placements that cramp the opponent without cramping itself.
- The CPU always avoids its own third consecutive move of a piece.
- Verify the dial: a simulated-games script plays CPU vs CPU at different levels (for example 25 vs 50) and confirms higher levels win more often.

**Done when:** A level-50 CPU clearly beats a level-0 CPU over about 50 simulated games.
**Docs:** `ai.md` describes the evaluation function and weights.

---

### Phase 9: CPU Deep Search
**Goal:** A strong CPU at the top of the dial.

- `ai/search.js`: minimax with alpha-beta pruning for `searchDepth` 2 to 4, using the Phase 8 evaluation at the leaves.
- **Repetition in search:** a human move that would be their third consecutive repeat is treated as an opening for a challenge; since the CPU challenges all violations at Hard, count it as an immediate win for the CPU.
- **Performance matters here:** slides go any distance, rotations pivot about every external corner in three amounts, flips have four sides, and chips move like queens, so one position can have well over a hundred legal moves. Profile `getLegalMoves` first and optimize it before deepening the search. Order moves best-first so pruning works.
- Run the search in a **Web Worker** (`ai/worker.js`) so the page never freezes.
- Iterative deepening with a time budget (for example 1 second). On Hard, scale the budget to the CPU's remaining chess-clock time so it never loses on time.

**Done when:** A level-90 CPU clearly beats a level-50 CPU, and move time stays under the budget on a phone.
**Docs:** `ai.md` explains the search; document the performance numbers.

---

### Phase 10: Polish and Quality of Life
**Goal:** Make it pleasant to use.

- Animations for slides, rotations (swinging around the pivot), and flips (short, simple tweens).
- Highlight legal moves for the selected piece (on Easy; Medium and Hard show only the possible moves, so rule-breaking is the player's responsibility).
- Touch support and a mobile-friendly layout.
- Keyboard support and accessibility (focusable buttons, readable contrast). The yellow/green scheme is harder to tell apart for some color-blind players, so add a pattern or outline difference between players' pieces.
- Optional undo on Easy only (reuses `history.js`; not part of the official rules).
- Save and resume the current game in `localStorage`, including both clocks.
- In-game "How to play" page generated from `docs/rules.md`.
- Optional sound effects with a mute button.

**Done when:** It feels good on both phone and desktop and a new player can learn it without reading the repo.
**Docs:** Final README with screenshots; changelog.

---

### Phase 11 (Optional / Later)
- **Online play** (needs a backend or peer-to-peer; out of scope for plain GitHub Pages).
- Puzzle mode: preset positions where you must entrap in N moves.
- AI vs AI spectator mode for tuning.
- Inappropriate-challenge ("IA") tracking and other tournament extras for closer fidelity to the paper game.

---

## Testing Approach

- `tests/tests.html` imports the logic modules and runs plain `assert` checks, printing pass/fail to the page. No test framework needed.
- Only logic is tested (`pieces`, `transforms`, `rules`, `analyze`, `moves`, `challenges`, `game`, `ai`). Rendering is checked by eye.
- Every rule from `docs/rules.md` should have at least one test with a hand-built state.
- Time-based rules are tested by calling the game's time-up functions directly.
- Add a test for each bug you fix.

## Documentation Plan

| File | Purpose | When it's updated |
|------|---------|-------------------|
| `README.md` | What it is, how to run, how to play, controls, difficulty levels | Every phase |
| `docs/rules.md` | The rules being implemented, including challenges and timing | Phase 0, then notes as implemented |
| `docs/architecture.md` | File map, data model, how logic and rendering connect | Phases 1 to 6 |
| `docs/ai.md` | The difficulty dial, CPU interface, how it plays | Phases 7 to 9 |
| `docs/decisions.md` | Rule ambiguities and what we chose | Whenever a decision is made |

Code conventions: `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for constants, one exported concept per module section, and a one-line comment at the top of each file saying what it does.

---

## Open Questions (record answers in `docs/decisions.md`)

None at the moment. Every question raised during planning has been answered and moved into "Confirmed Rules Decisions" above. New questions that come up during a phase should be added here and resolved in `docs/decisions.md`.
