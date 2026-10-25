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

## To Be Written

- Phase 1: state, renderer, constants
- Phase 2: shapes and transform helpers, with diagrams of "external corner" and "flip over a side"
- Phase 4: movement rules
- Phase 6: challenge procedure
