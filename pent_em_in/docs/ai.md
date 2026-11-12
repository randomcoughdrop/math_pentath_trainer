# The CPU Opponent

Built in stages: Phase 7 gave the computer a seat at the table and the difficulty dial. Phase 8 (below) added an evaluation function and a one-move-ahead search. Phase 9 will add a deeper search (see `../DEVELOPMENT_PLAN.md`).

## One Dial

One difficulty number, `level` (0 to 100), drives both the rules and the CPU.

- The menu's Easy, Medium, and Hard buttons set `level` to 15, 50, and 80 (`PRESET_LEVELS` in `constants.js`).
- To try any other value, add `?level=NN` to the address (for example `?players=cpu&level=70`). The rules band and the CPU both follow it. The same address options work for the rest: `?difficulty=`, `?first=`, `?colors=`.
- `cpuParams(level)` in `ai/params.js` turns the number into `{ randomMoveRate, searchDepth, nearBestRate, challengeRate, illegalMoveRate }`.

| level | randomMoveRate | searchDepth | nearBestRate |
|-------|----------------|-------------|--------------|
| 0 | 100% | 0 | 0% |
| 25 | 60% | 1 | 20% |
| 50 | 30% | 2 | 40% |
| 75 | 10% | 3 | 30% |
| 100 | 0% | 4 | 0% |

Values between rows are on a straight line (`searchDepth` is rounded). So Hard (level 80) is 8% random and 24% near-best, and level 100 only ever plays the best move it finds. `searchDepth` is not used until Phase 9: every level that isn't playing randomly looks exactly one move ahead.

On each turn the CPU rolls once: with chance `randomMoveRate` it plays a random legal move. Otherwise, with chance `nearBestRate` it plays a **near-best** move (a random one from the 2nd to 4th best), and otherwise one of the best moves (ties broken at random). The band sets the other two numbers:

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
| `ai/evaluate.js` | `evaluate(state, player)` scores a position; the `WEIGHTS` live here |
| `ai/mobility.js` | `fastLegalMoves`, `mobility`, `afterMove`: a fast move counter and cheap "what if" positions |
| `ai/search.js` | `searchMove` (look one move ahead) and `chooseByScore` (best, or near-best) |
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
   - else `searchMove` (see below).
5. **Placement:** when playing randomly it picks a shape first (so shapes with many positions aren't favored), then a random orientation and position. Otherwise it scores a random sample of 60 legal placements and picks the best (or a near-best) one.
6. **Choices after a challenge:** it looks one move ahead on each option (assuming its best reply if it moves, and the opponent's worst-for-it reply if they move) and takes the better one. It plays these without the near-best randomness, since they are rare.

Legal here includes not repeating a chip move or moving one piece three turns in a row, so the CPU never makes those mistakes by accident.

## In the Page

- Each player is `"human"` or `"cpu"` in `state.settings.players`. Against the computer you are Player 1 and the computer is Player 2.
- `main.js` `scheduleCpu` waits half a second after each redraw, then plays the CPU's move, so moves can be followed. The squares it just played on are outlined with a dashed yellow line until you act.
- While the computer is acting, the board, trays, and challenge controls ignore clicks, and the status line reads "Computer (Blue) is thinking...".
- Pausing stops the CPU too.

## The Evaluation

`evaluate(state, me)` is about freedom to move, because the game is won by leaving the opponent with no piece that can move. Each side's moves are counted as if it were that side's turn, with its own repeat rules applied (so a piece that has moved twice in a row counts as having no moves, which is the "don't get forced into a third repeat" penalty for free).

| Term | Weight |
|------|--------|
| my piece moves minus their piece moves | 1 per move |
| my chip moves minus their chip moves | 0.25 per move |
| their pieces with 2 or fewer moves, minus mine | 5 per piece |
| they have no piece that can move | +10000 (a win) |
| I have no piece that can move | -500 |

These are the starting weights and have not been tuned; they are in `WEIGHTS` in `ai/evaluate.js`.

## Search and Speed

`searchMove` applies each legal move with `afterMove` (a cheap copy of the position, no history or log), scores it with `evaluate`, and chooses with `chooseByScore`. The legal moves are listed by `fastLegalMoves`, which gives exactly the same moves as `getLegalMoves` in `moves.js` (a test compares them) but about three times faster, because it stops looking along a line as soon as something is in the way. A turn at the top level takes roughly 0.2 seconds on the machine used for testing. Phase 9 will need to be much faster before searching deeper.

## Results

`node tools/compare.mjs A B [games]` plays level A against level B, swapping seats and who moves first. Games run to 400 moves; one that isn't over by then goes to whichever side has more freedom to move (a "tiebreak"). Rules level was Easy (no rule-breaking), 40 games each:

| Match | Wins | Games ended by the rules |
|-------|------|-----|
| level 50 vs level 0 | 37 to 3 | 23 of 40 |
| level 80 vs level 50 | 38 to 2 | 15 of 40 |
| level 100 vs level 80 | 28 to 12 | 7 of 40 |
| level 100 vs level 0 | 40 to 0 | 37 of 40 |

Higher levels win clearly, so the dial works. The weak spot: two strong players rarely trap each other within 400 moves, so most of their games are decided by the tiebreak, not by a real win. Phase 9's deeper search should help.

## Checking It

`tools/simulate.mjs` and the "CPU vs CPU" tests play full games and fail if the game ever refuses a CPU move. Random movement rarely ends a game quickly, so many simulated games stop at a step limit unfinished; that is expected until Phase 8 gives the CPU a goal.

## To Be Written

- Phase 9: the search, the Web Worker, and performance numbers
