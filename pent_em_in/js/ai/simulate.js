// Plays whole games with the CPU on both sides (no page, no clocks). Used by the
// tests and by tools/simulate.mjs to check the CPU and, later, to compare levels.

import { createInitialState } from "../state.js";
import { applyMove } from "../game.js";
import { actorNow } from "../players.js";
import { cpuParams } from "./params.js";
import { nextCpuMove } from "./cpu.js";
import { makeRng } from "./random.js";

// options: { level (the rules band), cpuLevels: {1, 2} (each side's strength),
//            seed, maxSteps, startingPlayer }
// Returns { state, steps, finished, problems } where problems lists any move the
// game refused (there should be none).
export function playCpuGame(options = {}) {
  const level = options.level ?? 50;
  const cpuLevels = options.cpuLevels ?? { 1: level, 2: level };
  const rng = makeRng(options.seed ?? 1);
  const maxSteps = options.maxSteps ?? 400;
  const params = { 1: cpuParams(cpuLevels[1]), 2: cpuParams(cpuLevels[2]) };

  let state = createInitialState({
    level, startingPlayer: options.startingPlayer ?? 1,
    players: { 1: "cpu", 2: "cpu" },
  });
  const problems = [];
  let steps = 0;

  while (steps < maxSteps) {
    const actor = actorNow(state);
    if (actor === null) break;
    const move = nextCpuMove(state, params[actor], rng);
    if (move === null) break;
    const result = applyMove(state, move);
    steps++;
    if (!result.ok) {
      problems.push({ move, message: result.message });
      break;
    }
    state = result.state;
    if (state.phase === "gameover") {
      // One chance for the loser to challenge the win, then it's over.
      const last = nextCpuMove(state, params[actorNow(state) ?? 1], rng);
      if (last) state = applyMove(state, last).state ?? state;
      break;
    }
  }
  return { state, steps, finished: state.phase === "gameover", problems };
}
