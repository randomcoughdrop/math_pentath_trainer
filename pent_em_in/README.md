# Pent 'Em In

A browser version of Pent 'Em In, a two-player transformational geometry game played on a 13 × 9 grid. Each player places five pentominoes, then tries to **entrap** all of the opponent's pieces by sliding, rotating, and flipping their own.

Play it with a friend on the same screen, or against the computer.

> **Status:** Phase 7 (a complete game for two players on one screen or against the computer: start screen, placement, movement, clocks, rule-breaking moves and challenges on Medium and Hard, and a game-over screen). The computer looks ahead several moves, thinking in the background so the page never freezes. See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the roadmap.

## Running It Locally

The game uses JavaScript modules, which browsers won't load from a plain `file://` address. Start a small local web server from the folder that contains this one:

```
python3 -m http.server
```

Then open `http://localhost:8000/pent_em_in/` in your browser.

On GitHub Pages it works as-is, with no build step.

To see the second color set (yellow and green instead of red and blue), add `?colors=yellow-green` to the address.

To choose things ahead of time, add options to the address: `?first=2` (who goes first in the first game), `?colors=yellow-green`, `?difficulty=hard`. Combine them with `&`, for example `?colors=yellow-green&difficulty=hard`.

## Controls (placement)

| Action | Mouse and keyboard | Touch |
|---|---|---|
| Pick a piece | Click it in your tray (click again to put it back) | Tap it |
| Rotate | `R` (clockwise), `Shift+R` (counterclockwise) | Rotate buttons |
| Flip | `F` | Flip button |
| Preview | Move over the board; a see-through ghost follows | Tap a square |
| Place | Click the square | Tap the same square again, or press Place |
| Cancel | `Esc` | Cancel button |

The ghost shows your color where the piece can go. It turns grey with a slash through each square where it can't (off the board, over a chip or piece, on a star, or touching an opponent's piece along an edge).

## Controls (movement)

Click one of your own pieces or chips to select it (a yellow outline appears). Squares and corners you can click are marked.

| Action | How |
|---|---|
| Slide a piece | Pick it up by any square, then click a marked square. The square you picked it up by lands there, and the whole piece moves along. Pointing at a marked square shows where the piece would end up. |
| Rotate a piece | Press **Rotate**, click one of the marked corners on the piece, then press **90°**, **180°**, or **270°** (always clockwise). Hovering over a turn button previews it. |
| Flip a piece | Press **Flip**, then click one of the see-through copies (one for each side it can flip over). |
| Move a chip | Click the chip, then click a marked square. Chips move like a queen in chess. |
| Deselect | **Deselect** button or `Esc` |

Only legal moves are marked, since Easy rules refuse anything else. A small **×2** badge on a piece means its owner has moved it twice in a row, so it can't be moved a third time. The move log on the right has a column for each player, listing the letter of each piece they moved (O for a chip); hover over an entry for the full description. The game ends when a player's pieces are all trapped.

To run the tests, open `tests/tests.html` the same way (for example `http://localhost:8000/pent_em_in/tests/tests.html`).

## Difficulty

One setting (Easy, Medium, or Hard) controls how strictly the rules are enforced, which clocks run, and how strong the computer is.

| | Easy | Medium | Hard |
|---|---|---|---|
| Rule-breaking moves | Refused | Allowed; the opponent must challenge them | Allowed; the opponent must challenge them |
| Clock | 60-minute game limit | 60-minute game limit, 60-second turn alert | 30-minute chess clock per player, 60-second turn alert |
| Computer | Plays randomly | Plays sensibly, sometimes breaks a rule | Plays strongly, never breaks a rule |

Details are in [docs/decisions.md](docs/decisions.md).

## Playing the Computer

Choose **Play the computer** on the start screen, and who goes first. You are Player 1 and the computer is Player 2. It moves after a short pause, and the squares it just played on are outlined in yellow. On Medium it sometimes breaks a rule (watch for it and challenge!) and challenges you most of the time you do. On Hard it never breaks a rule and challenges every rule break. Higher levels play better, and Medium and Hard sometimes play a near-best move instead of the best. See [docs/ai.md](docs/ai.md), including the `?level=` address option for trying any difficulty from 0 to 100.

## Challenges (Medium and Hard)

On Medium and Hard the game does not stop you from breaking a rule (moving a piece over a chip, putting a chip on a star, and so on). It is up to your opponent to notice.

- At the start of your turn, press **Challenge last turn**, then pick the rule you think your opponent broke.
- **You were right:** the board goes back to how it was. After a movement rule you either take your own turn or make your opponent move a pentomino. After a placement rule you place one of their shapes for them (legally). Moving the same piece three turns in a row wins the game on the spot.
- **You were wrong:** the move stands and you get a strike. After a movement rule your opponent chooses: you lose your turn, or you must move a pentomino. After a placement rule they move one of your chips. Three strikes loses the game.
- You can only challenge the turn just before yours, and only once. If a game ends by a forfeit or entrapment, the loser may challenge the winning move once; if it broke a rule, the loser wins instead.

## How to Play

1. **Start screen:** choose a difficulty and a color set, then press Start. (Playing the computer is coming later.)
2. **Placement:** each player in turn places one of their 12 pieces until both have placed five. See the placement controls above.
3. **Movement:** players take turns moving one piece or one chip. See the movement controls above.
4. **Winning:** you win if your opponent cannot place all five pieces, if all of their pieces are trapped so none can move, or (on Hard) if their clock runs out. If the 60-minute limit runs out on Easy or Medium, the player on the move finishes their turn, the other player gets a matching turn if needed, and the game is a tie unless someone has won by then.
5. **Clocks and pausing:** the bar above the board shows the clocks. On Medium and Hard, the turn timer flashes after 60 seconds (nothing else happens; tick the box to hear a beep too). **Pause** stops all clocks and hides the board until you press Resume.

The game-over box has **Play again** (same settings, new random first player) and **Back to menu**.

The official rules summary is in [docs/rules.md](docs/rules.md).

## Project Layout

```
pent_em_in/
├── index.html              Page shell
├── css/style.css           Page layout
├── js/                     Game code (logic, drawing, input, CPU)
├── tests/tests.html        Open in a browser to run the tests
└── docs/                   Rules, decisions, architecture, CPU notes
```

See [docs/architecture.md](docs/architecture.md) for what each file does.

## Documentation

| File | What it covers |
|------|----------------|
| [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) | The phased roadmap |
| [docs/rules.md](docs/rules.md) | The tournament rules summary |
| [docs/decisions.md](docs/decisions.md) | Rules the summary left open, and what we chose |
| [docs/architecture.md](docs/architecture.md) | How the code fits together |
| [docs/ai.md](docs/ai.md) | How the computer opponent works |
