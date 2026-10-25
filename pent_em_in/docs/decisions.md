# Decisions

Rules that the tournament summary (`rules.md`) left open, and what we chose. Add a row here whenever a new decision is made.

## Confirmed Rules Decisions

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
| Rule-breaking categories | Six challengeable categories (see below). Stars and passing over occupied squares are rule-breaking but possible; only off-board or overlapping landings are impossible. |
| Placement challenge | A correct challenge removes the piece, the challenger places one of the opponent's shapes for them, then takes their own turn. An incorrect one lets the challenged player move one of the challenger's chips. |
| Chess clock (Hard) | 30 minutes per player, no increment, running out of time loses. The 60-second turn alert still applies. |
| Difficulty control | Players see only the Easy / Medium / Hard presets. The underlying `level` number (0 to 100) is set in code through `PRESET_LEVELS`. |
| CPU starting values | The `randomMoveRate` / `searchDepth` table below is the starting point and is tuned by playing. |

## Two Kinds of "Not Allowed"

- **Impossible moves** never happen on any level: any part of a piece landing **off the board** or **on top of a chip or another piece**. The interface always refuses these.
- **Rule-breaking moves** are physically possible but against the rules. **Easy** refuses them. **Medium and Hard** accept them, and the opponent must spot and **challenge** them or they stand.

## Difficulty Scale

One number, `level` from 0 to 100, in three bands. Players only see the Easy / Medium / Hard buttons.

| | **Easy** (0–33) | **Medium** (34–66) | **Hard** (67–100) |
|---|---|---|---|
| Rule-breaking moves by players | Refused | Allowed; must be challenged | Allowed; must be challenged |
| Challenge button | Hidden | Always available at the start of a turn | Always available at the start of a turn |
| Three incorrect challenges | n/a | Loses the game | Loses the game |
| CPU rule-breaking moves | Never | Rarely (about 3% of turns) | Never |
| CPU challenges your rule-breaking moves | n/a | Most (about 80%) | All |
| Turn timer | None | 60-second soft alert | 60-second soft alert |
| Game clock | 60-minute cap, ends in a tie | 60-minute cap, ends in a tie | 30-minute chess clock per player; running out of time loses |

The CPU never makes a false challenge on any level.

CPU strength comes from the same number. Starting values, with straight-line interpolation between rows:

| level | randomMoveRate | searchDepth |
|-------|----------------|-------------|
| 0 | 100% | 0 |
| 25 | 60% | 1 |
| 50 | 30% | 2 |
| 75 | 10% | 3 |
| 100 | 0% | 4 (limited by a time budget) |

Preset levels (in `constants.js`): Easy = 15, Medium = 50, Hard = 90.

## Challenge Categories

| Category | Rule broken | Kind |
|----------|-------------|------|
| `placement-star` | A piece was placed on a star | Placement |
| `placement-contact` | A piece was placed sharing an edge with an opponent's piece | Placement |
| `slide-blocked` | A slide passed over a chip, piece, or star | Other |
| `chip-blocked` | A chip passed over an occupied square, or passed over or landed on a star | Other |
| `chip-repeat` | Two chip moves in a row | Other |
| `piece-repeat` | The same piece moved three turns in a row (chip moves in between don't break the streak) | Three-in-a-row |

## Challenge Outcomes

| Challenge | If correct (recorded "C") | If incorrect (recorded "I") |
|-----------|---------------------------|------------------------------|
| **Placement** | The opponent's piece is removed. The challenger chooses one of the opponent's remaining shapes and places it legally for them. The challenger then takes their own turn. | The challenged player may move one of the challenger's chips to a new location. The challenger then takes their own turn. |
| **Other** | The board is restored to before the illegal move. The challenger chooses either to take a turn or to force the opponent to move a pentomino. | The challenged player chooses either to make the challenger lose the turn or to force the challenger to move a pentomino. |
| **Three-in-a-row** | The challenger wins the game. | Same as "Other." |

Three incorrect challenges is an automatic loss.

## Time

- **Easy and Medium:** 60 minutes of active play. When time is called, the current turn is completed. If the player who had the move is the one who moved first, the other player gets one more turn so both have equal turns. If nobody has won, the game is a tie.
- **Hard:** each player has a 30-minute chess clock, no increment. A player whose clock reaches zero loses.
- **Turn alert (Medium and Hard):** a soft reminder after 60 seconds, with no penalty. Applies to human turns only.
- **Pausing:** allowed on every level. Paused time counts toward neither clock, and the board is hidden while paused.

## Definitions

- **External corner:** a grid vertex where exactly one of the four surrounding cells belongs to the piece (a convex corner of the outline).
- **Flip sides:** the four sides of the piece's bounding rectangle, so every piece has exactly four flips.
- **Consecutive chip moves:** a player's chip move followed by a chip move on that player's very next turn.
- **Stars:** a star square is a rule, not a physical obstacle. Landing on or passing over one is rule-breaking, not impossible.
