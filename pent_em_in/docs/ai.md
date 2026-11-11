# The CPU Opponent

Built in stages: Phase 7 (this document's first half) gives the computer a seat at the table and the difficulty dial. It plays at random for now. Phase 8 adds an evaluation function and a shallow search, and Phase 9 a deep search (see `../DEVELOPMENT_PLAN.md`).

## One Dial

One difficulty number, `level` (0 to 100), drives both the rules and the CPU.

- The menu's Easy, Medium, and Hard buttons set `level` to 15, 50, and 90 (`PRESET_LEVELS` in `constants.js`).
- To try any other value, add `?level=NN` to the address (for example `?players=cpu&level=70`). The rules band and the CPU both follow it. The same address options work for the rest: `?difficulty=`, `?first=`, `?colors=`.
- `cpuParams(level)` in `ai/params.js` turns the number into `{ randomMoveRate, searchDepth, challengeRate, illegalMoveRate }`.

| level | randomMoveRate | searchDepth |
|-------|----------------|-------------|
| 0 | 100% | 0 |
| 25 | 60% | 1 |
| 50 | 30% | 2 |
| 75 | 10% | 3 |
| 100 | 0% | 4 |

Values between rows are on a straight line (`searchDepth` is rounded). The band sets the other two numbers:

| | Easy (0 to 33) | Medium (34 to 66) | Hard (67 to 100) |
|---|---|---|---|
| `challengeRate` (spotting your rule-breaking) | 0 (no challenges exist) | 0.8 | 1 |
| `illegalMoveRate` (the CPU breaking a rule) | 0 | 0.03 | 0 |

The CPU never makes a false challenge: it only challenges a turn that really broke a rule.

## Files

| File | Job |
|------|-----|
| `ai/params.js` | `cpuParams(level)` |
| `ai/cpu.js` | `nextCpuMove(state, params, rng)`, `chooseMove`, `shouldChallenge`, `shouldChallengeWin` |
| `ai/search.js` | `searchMove`: picks among legal moves (random until Phase 8) |
| `ai/random.js` | A seedable random number generator, so simulated games can be repeated |
| `ai/simulate.js` | `playCpuGame`: plays a whole CPU-vs-CPU game with no page or clocks |
| `players.js` | `controllerOf`, `actorNow`, `cpuToAct`, `humanToAct`: who the game is waiting on |
| `../tools/simulate.mjs` | `node tools/simulate.mjs [games] [level]` plays games and prints a summary |

## How the CPU Plays

`nextCpuMove` returns the move the CPU should make right now, or `null`. It only ever returns ordinary moves that go through `applyMove`, so it can't do anything a person couldn't.

1. **Game over:** if the CPU lost and the human's winning move broke a rule, challenge the win (with probability `challengeRate`).
2. **A challenge decision is pending:** pick a choice at random; or place a random legal shape for the opponent; or move a random chip of the challenger's to a random empty non-star square.
3. **Otherwise:** challenge the human's last turn if it broke a rule (with probability `challengeRate`).
4. **Otherwise play a move:**
   - with probability `illegalMoveRate`, a random *possible* move that breaks a rule (never on Easy, where rule-breaking isn't allowed);
   - else with probability `randomMoveRate`, a random legal move;
   - else `searchMove` (random until Phase 8).
5. **Placement** picks a shape at random first (so shapes with many positions aren't favored), then a random orientation and position.

Legal here includes not repeating a chip move or moving one piece three turns in a row, so the CPU never makes those mistakes by accident.

## In the Page

- Each player is `"human"` or `"cpu"` in `state.settings.players`. Against the computer you are Player 1 and the computer is Player 2.
- `main.js` `scheduleCpu` waits half a second after each redraw, then plays the CPU's move, so moves can be followed. The squares it just played on are outlined with a dashed yellow line until you act.
- While the computer is acting, the board, trays, and challenge controls ignore clicks, and the status line reads "Computer (Blue) is thinking...".
- Pausing stops the CPU too.

## Checking It

`tools/simulate.mjs` and the "CPU vs CPU" tests play full games and fail if the game ever refuses a CPU move. Random movement rarely ends a game quickly, so many simulated games stop at a step limit unfinished; that is expected until Phase 8 gives the CPU a goal.

## To Be Written

- Phase 8: the evaluation function and its weights
- Phase 9: the search, the Web Worker, and performance numbers
