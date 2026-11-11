// Plays CPU-vs-CPU games and prints how they went.
//   node tools/simulate.mjs [games] [level]
import { playCpuGame } from "../js/ai/simulate.js";

const games = Number(process.argv[2] ?? 10);
const level = Number(process.argv[3] ?? 50);
const tally = { finished: 0, unfinished: 0, problems: 0 };
const reasons = {};

for (let seed = 1; seed <= games; seed++) {
  const result = playCpuGame({ level, seed, maxSteps: 600, startingPlayer: seed % 2 ? 1 : 2 });
  if (result.problems.length) { tally.problems++; console.log("seed", seed, result.problems); }
  if (result.finished) {
    tally.finished++;
    const key = result.state.winReason + (result.state.winner ? "" : " (tie)");
    reasons[key] = (reasons[key] ?? 0) + 1;
  } else tally.unfinished++;
}
console.log("level", level, tally, reasons);
