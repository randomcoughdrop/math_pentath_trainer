# The CPU Opponent

Built in stages: Phase 7 gave the computer a seat at the table and the difficulty dial. Phase 8 added an evaluation function and a one-move-ahead search. Phase 9 added a deep search that runs in a Web Worker (see `../DEVELOPMENT_PLAN.md`).

## One Dial

One difficulty number, `level` (0 to 100), drives both the rules and the CPU.

- The menu's Easy, Medium, and Hard buttons set `level` to 15, 50, and 80 (`PRESET_LEVELS` in `constants.js`).
- To try any other value, add `?level=NN` to the address (for example `?players=cpu&level=70`). The rules band and the CPU both follow it. The same address options work for the rest: `?difficulty=`, `?first=`, `?colors=`.
- `cpuParams(level)` in `ai/params.js` turns the number into `{ randomMoveRate, searchDepth, maxDepth, thinkingMs, nearBestRate, challengeRate, illegalMoveRate }`.

| level | randomMoveRate | searchDepth (minimum) | maxDepth | thinkingMs | nearBestRate |
|-------|----------------|-----------------------|----------|------------|--------------|
| 0 | 100% | 0 | 0 | 0 | 0% |
| 25 | 60% | 1 | 2 | 300 | 20% |
| 50 | 30% | 3 | 4 | 1000 | 40% |
| 75 | 10% | 5 | 10 | 3500 | 30% |
| 100 | 0% | 6 | 14 | 5000 | 0% |

Values between rows are on a straight line (depths and times are rounded). So Medium (level 50) looks at least 3 moves ahead, and Hard (level 80) looks at least 5 moves ahead, usually 6, with up to 3.8 seconds to think. Level 100 only ever plays the best move it finds.

**Depth is dynamic.** `searchDepth` is the least it will look (moves ahead, this player's and the opponent's alternating); it keeps going deeper than that while there is time, up to `maxDepth`, and stops when it expects the next depth not to finish within `thinkingMs`. So an easy position gets a deeper look and a crowded one a shallower one, and a faster device looks further than a slow one. Depth 1 is the simple one-move search from Phase 8; depth 2 and up is the deep search described below.

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
| `ai/engine.js` | The fast engine the search runs on: flat-array positions, move generation, make/unmake, and the score |
| `ai/search.js` | `searchMove` (one move ahead), `searchPosition` (the deep search), and `chooseByScore` (best, or near-best) |
| `ai/worker.js` | Runs `nextCpuMove` in a Web Worker so the page never freezes |
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

## The Deep Search

`searchPosition` in `ai/search.js` is minimax with alpha-beta pruning:

- It always scores from the point of view of the player choosing: on its own turns it takes the highest score, on the opponent's the lowest. Leaves are scored by the evaluation above.
- **Terminal positions:** a player with no piece that can move has lost. A win found sooner scores higher than a later one, so it takes the quickest.
- **Repetition:** the moves the search generates for the opponent already leave out a third turn in a row with the same piece. So a position where the opponent's only mobile piece has moved twice already has no moves for them, and the search scores it as a win. That is the "third repeat" idea from the plan, with no special case. (At Hard the CPU would challenge a real violation anyway.)
- **Iterative deepening:** it searches depth 1, then 2, and so on, keeping the answer from the last depth it finished. Up to the minimum depth (`searchDepth`) it is allowed three times the time budget; deeper than that it only starts the next depth if it expects it to finish within the budget (each depth takes about 3 to 4 times as long as the one before), so effort isn't wasted on a depth that will be cut off. If time runs out in the middle of a depth, that unfinished depth is thrown away. Depth 1 always finishes.
- **Move ordering:** with two or more moves left to look at, each move is first scored by a quick look at the position it leads to, and moves are tried best first. The best remaining move is picked lazily, because most positions cut off after the first few. The previous depth's order is used at the top.
- **Near-best moves:** to be able to pick the 2nd to 4th best, the top level keeps exact scores for the best four moves (any move that can't make the top four is cut off early). At level 100, where near-best is 0, only the best matters.
- **A forced win** stops the deepening.

The result goes through the same near-best/best choice as before (`chooseByScore`), and a final safety check makes sure the move is one the game accepts (`cpuStats.deepFallbacks` counts any that weren't; the tests insist it stays 0).

## The Engine and Speed

`getLegalMoves` analyzes every possible slide distance, rotation, and flip with text and arrays, which is far too slow to search with. `ai/engine.js` is a separate implementation of the same rules, built for speed:

- The position is flat arrays and a 13 x 9 grid of what's on each square; moves are made and taken back **in place** (no copying).
- A piece is an **orientation** (its shape turned and flipped some way) plus where its top-left cell is. Every orientation knows what each of its rotations (about every outer corner, 1 to 3 quarter turns) and flips turn into, worked out once and remembered, so move generation only checks five squares per move.
- A slide stops being checked at the first thing in the way.
- A move is one number.

Tests compare it with the real game: it lists exactly the same moves as `getLegalMoves` in sampled positions, scores exactly like `evaluate()`, a move made in the engine gives the same position as the game's `applyMove`, and unmaking a move restores everything. `fastLegalMoves` in `mobility.js` stays (the one-move search and the checks after a challenge still use it).

**Speed** (measured on the development machine, in a browser worker, on mid-game positions; the time of one whole CPU move):

| Setting | Time |
|---|---|
| Setting | Depth reached | Time for one move |
|---|---|---|
| level 50 (Medium) | 4 | 0.0 to 0.1 s |
| level 80 (Hard) | 6 | 1.4 to 3.8 s |
| level 100 | 7 | 2.6 to 4.1 s |

(Four mid-game positions each. A search at one depth deeper takes roughly 3 to 4 times as long.) A phone is probably 3 to 5 times slower, so it would reach about one depth less in the same time. The minimum depth gets up to three times the budget before giving up, so on a very slow device a Hard move could take as long as about 11 seconds before the computer settles for a shallower answer.

**Time budget:** `thinkingMs` in the table, per move. On Hard's chess clock the budget is also never more than 1/40 of the time left (and never below 0.1 s), so thinking can't make the computer lose on time. If a browser can't start workers, the page falls back to thinking on the main thread.

## Results

`node tools/compare.mjs A B [games] [rulesLevel] [maxSteps] [budgetMs]` plays level A against level B, swapping seats and who moves first. Games run to 400 moves; one that isn't over by then goes to whichever side has more freedom to move (a "tiebreak"). Rules level was Easy (no rule-breaking), 40 games each:

| Match | Wins | Games ended by the rules |
|-------|------|-----|
| level 50 vs level 0 | 37 to 3 | 23 of 40 |
| level 80 vs level 50 | 38 to 2 | 15 of 40 |
| level 100 vs level 80 | 28 to 12 | 7 of 40 |
| level 100 vs level 0 | 40 to 0 | 37 of 40 |

Higher levels win clearly, so the dial works. The weak spot: two strong players rarely trap each other within 400 moves, so most of their games are decided by the tiebreak, not by a real win.

With the Phase 9 deep search (same setup, 40 games each, no time limit so the depth is fixed):

| Match | Wins | Games ended by the rules |
|-------|------|-----|
| level 50 vs level 0 | 40 to 0 | 36 of 40 |
| level 80 vs level 50 | 40 to 0 | 34 of 40 (was 15) |
| level 100 vs level 80 | 40 to 0 | 35 of 40 (was 7) |
| level 100 vs level 50 | 40 to 0 | 38 of 40 |

Looking ahead lets the computer actually finish games: real wins went from a minority to about 85 to 95 percent of games. Level 100 now beats level 80 every time, where before it won 28 of 40.

With dynamic depth (Phase 9 follow-up; 20 games, 300 ms budget per move to keep the test short, so both sides think less than they do in the page):

| Match | Wins | Games ended by the rules |
|-------|------|-----|
| level 80 vs level 50 | 19 to 1 | 17 of 20 |

(A level 100 vs level 80 run at the real budgets was too slow to finish.)

## Checking It

`tools/simulate.mjs` and the "CPU vs CPU" tests play full games and fail if the game ever refuses a CPU move. Games between weak players often stop at the step limit unfinished; the stronger the players, the more games end by a real win (see Results).

