# The CPU Opponent

Not built yet. This file is filled in during Phases 7 to 9 (see `../DEVELOPMENT_PLAN.md`).

## Planned Design

One difficulty number, `level` (0 to 100), drives both the rules and the CPU. From it, `cpuParams(level)` computes:

- `randomMoveRate`: the chance the CPU plays a random legal move instead of its best one
- `searchDepth`: how many moves ahead the CPU looks
- `challengeRate`: how often the CPU challenges a human's rule-breaking move
- `illegalMoveRate`: how often the CPU deliberately breaks a rule

The starting values are in `decisions.md`.

## To Be Written

- Phase 7: the CPU interface (`chooseMove`, `shouldChallenge`) and the `cpuParams` table
- Phase 8: the evaluation function and its weights
- Phase 9: the search, the Web Worker, and performance numbers
