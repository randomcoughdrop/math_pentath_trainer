# Pent 'Em In

A browser version of Pent 'Em In, a two-player transformational geometry game played on a 13 × 9 grid. Each player places five pentominoes, then tries to **entrap** all of the opponent's pieces by sliding, rotating, and flipping their own.

Play it with a friend on the same screen, or against the computer.

> **Status:** Phase 3 (two players on one screen can place their five pieces each). Moving pieces arrives in Phase 4. See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the roadmap.

## Running It Locally

The game uses JavaScript modules, which browsers won't load from a plain `file://` address. Start a small local web server from the folder that contains this one:

```
python3 -m http.server
```

Then open `http://localhost:8000/pent_em_in/` in your browser.

On GitHub Pages it works as-is, with no build step.

To see the second color set (yellow and green instead of red and blue), add `?colors=yellow-green` to the address.

To choose who goes first instead of the random draw, add `?first=1` or `?first=2`. Combine options with `&`, for example `?colors=yellow-green&first=2`.

## Controls (placement phase)

| Action | Mouse and keyboard | Touch |
|---|---|---|
| Pick a piece | Click it in your tray (click again to put it back) | Tap it |
| Rotate | `R` (clockwise), `Shift+R` (counterclockwise) | Rotate buttons |
| Flip | `F` | Flip button |
| Preview | Move over the board; a see-through ghost follows | Tap a square |
| Place | Click the square | Tap the same square again, or press Place |
| Cancel | `Esc` | Cancel button |

The ghost shows your color where the piece can go. It turns grey with a slash through each square where it can't (off the board, over a chip or piece, on a star, or touching an opponent's piece along an edge).

To run the tests, open `tests/tests.html` the same way (for example `http://localhost:8000/pent_em_in/tests/tests.html`).

## Difficulty

One setting (Easy, Medium, or Hard) controls how strictly the rules are enforced, which clocks run, and how strong the computer is.

| | Easy | Medium | Hard |
|---|---|---|---|
| Rule-breaking moves | Refused | Allowed; the opponent must challenge them | Allowed; the opponent must challenge them |
| Clock | 60-minute game limit | 60-minute game limit, 60-second turn alert | 30-minute chess clock per player, 60-second turn alert |
| Computer | Plays randomly | Plays sensibly, sometimes breaks a rule | Plays strongly, never breaks a rule |

Details are in [docs/decisions.md](docs/decisions.md).

## How to Play

Coming in Phase 5, once the game is playable. The official rules summary is in [docs/rules.md](docs/rules.md).

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
