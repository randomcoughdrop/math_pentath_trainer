# Changelog

## Phase 10: Polish
- Animations for slides, rotations, flips, and chips.
- Keyboard placement (arrow keys and Enter), visible focus outlines.
- Optional piece patterns (Player 2 hatched), remembered.
- Undo on Easy only.
- Save and resume in the browser (comes back paused).
- In-game How to play, rendered from `docs/rules.md`.
- Sound effects with a mute checkbox.

## Phase 9: CPU deep search
Search runs in a Web Worker with dynamic depth (about 3 on Medium, 6+ on Hard).

## Phase 8: CPU evaluation and shallow search
Mobility-based evaluation, near-best moves, Hard preset 80.

## Phase 7: The computer
CPU opponent and hidden difficulty dial (`?level=`).

## Phases 0-6
Rules, board, pieces, placement, movement, endings and clocks, challenges. See `DEVELOPMENT_PLAN.md`.
