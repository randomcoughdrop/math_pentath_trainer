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
| Rule-breaking categories | Seven challengeable categories (see below). Stars and passing over occupied squares are rule-breaking but possible; only off-board or overlapping landings are impossible. |
| Placement challenge | A correct challenge removes the piece, the challenger places one of the opponent's shapes for them, then takes their own turn. An incorrect one lets the challenged player move one of the challenger's chips. |
| Chess clock (Hard) | 30 minutes per player, no increment, running out of time loses. The 60-second turn alert still applies. |
| Difficulty control | Players see only the Easy / Medium / Hard presets. The underlying `level` number (0 to 100) is set in code through `PRESET_LEVELS`. |
| CPU starting values | The `randomMoveRate` / `searchDepth` table below is the starting point and is tuned by playing. |
| Boot and hat drawing | Chips are plain solid discs. The boot and hat are pictures printed on the board under the starting squares, and both of a player's squares show the same picture. Player 1's squares show boots and Player 2's show hats. The rules don't say which player gets which, so this is cosmetic (`START_MARKERS` in `constants.js`). |
| Coordinates | The rules count rows and columns from 1; the code counts from 0. |
| Rotation direction | The code rotates clockwise in quarter turns (1, 2, or 3). Since any multiple of 90° is allowed in one turn, direction doesn't change which positions a player can reach. |

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

Preset levels (in `constants.js`): Easy = 15, Medium = 50, Hard = 80 (changed from 90 in Phase 8).

## Challenge Categories

| Category | Rule broken | Kind |
|----------|-------------|------|
| `placement-star` | A piece was placed on a star | Placement |
| `placement-contact` | A piece was placed sharing an edge with an opponent's piece | Placement |
| `slide-blocked` | A slide passed over a chip, piece, or star | Other |
| `star-landing` | A slide, rotation, or flip ended with the piece on a star | Other |
| `chip-blocked` | A chip passed over an occupied square, or passed over or landed on a star | Other |
| `chip-repeat` | Two chip moves in a row | Other |
| `piece-repeat` | The same piece moved three turns in a row (chip moves in between don't break the streak) | Three-in-a-row |

## Challenge Outcomes

| Challenge | If correct (recorded "C") | If incorrect (recorded "I") |
|-----------|---------------------------|------------------------------|
| **Placement** | The opponent's piece is removed. The challenger chooses one of the opponent's remaining shapes and places it legally for them. The challenger then takes their own turn. | The challenged player may move one of the challenger's chips to a new location. The challenger then takes their own turn. |
| **Other** | The board is restored to before the illegal move. The challenger chooses either to take a turn or to move one of the opponent's pentominoes themselves. | The challenged player chooses either to make the challenger lose the turn or to force the challenger to move a pentomino. |
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

## Phase 3 Implementation Decisions

| Topic | Decision |
|---|---|
| Ghost style | Player's color when the spot is allowed; grey with a slash through each square when it is not. Green/red was avoided because red and green are player colors, and the slash works for color-blind players. |
| Touch placement | Two steps: tap to position the ghost, tap the same square (or Place) to confirm. |
| Held piece anchor | The piece is held by its middle (`top = row - floor((h-1)/2)`), so it stays under the cursor as it rotates. |
| Forfeit check | A player with no legal placement loses, on every difficulty level. |
| Pieces touching own pieces | Allowed; only edge contact with an opponent's piece is a violation. Corner contact is always fine. |
| Who moves first in the movement phase | The starting player, because turns simply alternate through the ten placements. |
| Starting player | Random draw (announced in the status line); `?first=1` or `?first=2` overrides it. |

## Phase 4 Implementation Decisions

| Topic | Decision |
|---|---|
| Landing on a star by moving a piece | Breaks a rule (`star-landing`, challenge kind "Other"). Rotating or flipping *over* a star is fine; only where the piece ends up counts. |
| Touching an opponent's piece after moving | Allowed. The edge-contact rule only applies when placing. |
| Who moves which chips | Each player moves only their own two chips. |
| Slide input | Pick the piece up by one of its squares; marked squares show where that square can land. Pointing at one shows a ghost of the piece there. |
| Rotate input | Press Rotate, click a marked corner, then press 90°, 180°, or 270° (always clockwise). Hovering over a button previews the result. |
| Flip input | Press Flip, then click one of the see-through copies. There is one for each side the piece can legally flip over. |
| Easy highlighting | Only legal moves are marked or clickable. |
| Streak counting | Kept per player (`state.repeat`): the piece they last moved and for how many of their own turns in a row. A chip move in between leaves it alone; moving any other piece starts it over at 1. |
| Streak badge | A "×2" badge sits on a piece its owner has moved twice in a row. |
| Entrapment | A player whose pieces all have no legal move loses when their turn starts (`winReason: "entrapment"`), including at the very start of the movement phase. A trapped player who still has chip moves counts as trapped. |
| Piece trays in movement | Hidden once placement is over. |
| History | A snapshot of the state is saved before every move, placements included. |

## Phase 5 Implementation Decisions

| Topic | Decision |
|---|---|
| Menu | A start screen with Players (the computer is shown but disabled), Difficulty (three presets), and Colors. `?difficulty=`, `?colors=`, and `?first=` preselect or override. |
| Game over | A box above the board with the winner and the reason and two buttons (Play again, Back to menu). It sits above the board rather than covering it, so the final position stays visible. |
| Play again | Same settings, new random first player. |
| When the clocks run | From the first placement. The chess clock runs for whoever is on the move; the game cap counts all play. |
| Turn alert | Medium and Hard only: after 60 seconds on a turn the turn timer flashes until the turn ends, with an optional beep (a checkbox, off by default). No penalty. |
| Equal turns when the cap runs out | The player on the move finishes. If they moved first in the game, the other player gets one more turn. Then it is a tie unless someone wins first. |
| Chess clock at zero | That player loses immediately, even in the middle of their turn. |
| Pausing | Available on every level and stops every clock. The board and controls are hidden while paused. Keyboard shortcuts are ignored. |
| Long gaps | The clock adds at most 10 seconds per timer tick, so a sleeping computer or hidden tab doesn't drain time. |
| Medium and Hard rules | Superseded in Phase 6: they now allow rule-breaking moves (see below). |


## Phase 6 Implementation Decisions

| Topic | Decision |
|---|---|
| Who can challenge | The player to move, once, against the opponent's immediately preceding turn, before moving. The button is disabled when there is nothing to challenge, rather than hidden. |
| Not telling | A wrong challenge only costs a strike; the game never hints whether the last move was legal. |
| Correct placement challenge | The offender's piece goes back to their unused shapes, then the challenger places any one of the offender's remaining shapes legally. If the offender has no legal placement, they lose by forfeit. |
| Incorrect placement challenge | The challenged player moves one of the challenger's chips to any empty non-star square. |
| Forced pentomino move | The chosen player may not move a chip that turn (`mustMovePiece`). If no piece can move, the requirement is dropped. |
| Winning by an illegal move | A game ended by forfeit or entrapment can be challenged once by the loser; if the final move broke a rule, the loser wins (`winReason: "declared-win"`). |
| What a challenge keeps | Restoring the board keeps strikes, the written log, and the time-called flags. |
| Medium and Hard move lists | The UI offers every possible move, not just legal ones, so the rule-breaking can actually be attempted. |

## Easy-Only Movement Help

| Topic | Decision |
|---|---|
| Stuck pieces | On Easy, the player's own pieces that have no legal move are drawn slightly washed out (grey overlay). Medium and Hard never do this. |
| Rotate and Flip buttons | On Easy, greyed out when the selected piece has no legal rotation or flip. |

## Phase 7 Implementation Decisions

| Topic | Decision |
|---|---|
| Seats | Against the computer you are always Player 1 (Red by default) and the computer is Player 2. "Who goes first" is Random, You, or The computer. |
| Trying other levels | `?level=0-100` in the address overrides the preset; the rules band and the CPU follow it. |
| Delay and highlight | The computer waits 500 ms before acting. Its last move is outlined with a dashed yellow line until the person acts. |
| Locked controls | While the computer acts, board, tray, and challenge controls are ignored. The "Challenge the winning move" button is only shown to a human loser. |
| Pending choices | The CPU chooses at random for now; Phase 8 may pick sensibly. |
| Piece choice | When placing, the CPU picks a shape first, then a position, so it isn't biased toward shapes with many positions. |
| Speed fix | `copyState` shares history snapshots; a 600-move game went from minutes to seconds. |

## Phase 8 Implementation Decisions

| Topic | Decision |
|---|---|
| Hard preset | Level 80 instead of 90, so the top of the dial (100) is still stronger than Hard. |
| Near-best moves | Of the moves that aren't random, `nearBestRate` of the time the CPU plays the 2nd to 4th best move. The rate is 0 at level 0 and level 100, so level 100 only ever plays the best. |
| Evaluation | Freedom to move (see `ai.md`). A piece that has moved twice in a row counts as having no moves, which gives the "avoid my own third repeat" penalty without a special rule. |
| Placement | The CPU scores a random sample of 60 legal placements instead of every one (there can be thousands). Shapes are not ranked in advance: the score of each placement decides. |
| Search depth | `searchDepth` is ignored until Phase 9; every non-random level looks one move ahead. |
| Challenge choices | Scored by a one-move lookahead on each option, without the near-best randomness. |
| Simulation | Games that hit the step limit are decided by who has more freedom to move, and reported separately from real wins. |

## Move Log Format

| Topic | Decision |
|---|---|
| Layout | A table with one column per player, each listing that player's moves in order. |
| Entries | Just the piece letter (O for a chip). A piece placed for a player after a challenge is in that player's column. |
| Other events | Challenges, challenged wins, and decisions show a short italic word (for example "challenge ✓"), since they have no letter. |
| Detail | The full sentence (direction, distance, rows and columns) is the hover text on each entry. |

## Phase 9 Implementation Decisions

| Topic | Decision |
|---|---|
| Separate engine | The search runs on `ai/engine.js`, a second implementation of the movement rules, because the game's own move code is far too slow to search with. Tests keep the two identical. |
| Search style | Minimax from the choosing player's point of view, alpha-beta, iterative deepening, lazy best-first move ordering. No transposition table or other extras yet. |
| Repetition | Not a special case: the opponent's generated moves already leave out a third repeat, so a trapped opponent is simply a win. |
| Near-best moves | The top level keeps exact scores for the best four moves when `nearBestRate` is above 0. |
| Depth table | First kept as planned (2, 3, and 4), then made dynamic (see "Dynamic Search Depth" below). |
| Time budget | Per level (see "Dynamic Search Depth"); on the chess clock never more than 1/40 of the time left, minimum 0.1 s. Depth 1 always finishes, and an unfinished deeper round is discarded. |
| Worker | One module worker (`ai/worker.js`). The saved history is left out of the message because it is large and unused. Falls back to the main thread if the worker can't start or fails. |
| Pausing | A move that arrives while paused is dropped, and the computer thinks again after Resume. |
| Computer's turn alert | The turn reminder no longer counts the computer's turns. |

## Dynamic Search Depth

| Topic | Decision |
|---|---|
| Depth | Each level has a minimum depth, a maximum depth, and a thinking time (`params.js`). The search deepens while the next depth is expected to fit in the time, so depth varies with the position and the device. |
| Medium | At least 3 moves ahead, at most 4, 1 second. |
| Hard (80) | At least 5 moves ahead, usually 6, at most 11, 3.8 seconds. Most moves take under 4 seconds here. |
| Level 100 | At least 6, usually 7, at most 14, 5 seconds. |
| Safety | The minimum depth may use up to 3 times the budget; after that the last finished depth is used. |
| Simulations | `playCpuGame` and `tools/compare.mjs` default to a 200 ms budget so games finish quickly; this makes the simulated computers weaker than in the page. |

## Phase 10 Implementation Decisions

- **Undo is Easy only.** It is not in the official rules, so Medium and Hard never offer it. Against the computer it removes your move and the reply, so it is your turn again. It is unavailable once time is called or the game is over.
- **Saves are replays, not snapshots.** A save is the list of events, so it stays small and can't hold an impossible position; a save that fails to replay is discarded.
- **Resume comes back paused,** so the clocks don't run while you find your place. A finished game clears the save. Only one game is saved.
- **Sound effects are on by default** (nothing plays until the first tap or key press, a browser rule). The turn-reminder beep keeps its own checkbox.
- **Piece patterns are optional** and remembered; Player 2 is hatched.
- **Animations are skipped** when the system asks for reduced motion.

## Forced Moves After a Challenge

When a challenge is correct and the challenger chooses "force a move", the **challenger picks and makes a move with one of the offender's pentominoes** (a legal slide, turn, or flip; no chips, no rule-breaking). The same applies the other way after an incorrect challenge: the challenged player moves one of the challenger's pentominoes. Details:

- The forced move replaces the owner's turn, so afterwards it is the player who chose it who is on the move.
- It does not count toward the owner's three-in-a-row streak, and it cannot be challenged.
- It is written in the log under the owner's column, with hover text saying who moved it.
- If the piece's owner has no legal pentomino move, nothing is forced.
- The computer picks the forced move that leaves it best off by its own evaluation. (`state.forcedBy` records who chooses.)

## Hard: Free Piece Moves

On Hard, a player who picks up a piece gets no marked destinations, corners, or flip choices. The piece's old position stays as a very faint ghost, and a stronger ghost follows the pointer. Rotate/flip (R, F, or the buttons) turn the ghost freely, and clicking drops it ("Move here" on touch after a second tap). The game then looks for the one slide, rotation, or flip that gives exactly that result; if none does, the drop is refused with a message and the piece stays picked up. Rule-breaking drops are accepted, as on any Hard move, and can be challenged. Chips still show their destinations. Easy and Medium are unchanged.
