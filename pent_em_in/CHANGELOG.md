# Changelog

## After Phase 10
- Hard: no more "moved twice in a row" reminder.
- Hard: clicking another of your pieces or chips while carrying a piece switches to it.
- Hard: the piece ghost never turns grey and the Place button stays available, so the game doesn't hint that a placement or move is wrong (impossible ones are still refused when you try).
- The 270° turn is now -90° (a quarter turn the other way). Same move, clearer name.
- The computer plays a flip instead of a half turn when they score the same (and when they land on identical squares).
- A correct challenge that forces a move now lets the challenger move one of the offender's pieces (and the reverse after an incorrect challenge). The computer handles this too.
- Hard: free piece moves with a faint ghost of the old position and a stronger ghost for the drop; no marked destinations.

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
