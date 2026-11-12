// Plays two CPU levels against each other and reports who wins.
//   node tools/compare.mjs [levelA] [levelB] [games] [rulesLevel] [maxSteps]
// Each pair of games swaps who goes first and who is Player 1. A game that hits
// the step limit goes to the player with more freedom to move (a "tiebreak").
import { playCpuGame } from "../js/ai/simulate.js";

const [a = 50, b = 0, games = 20, rules = 15, maxSteps = 400] = process.argv.slice(2).map(Number);
const wins = { a: 0, b: 0 };
let ties = 0, decided = 0, steps = 0;
const started = Date.now();

for (let game = 0; game < games; game++) {
  const aIsPlayer1 = game % 2 === 0;
  const cpuLevels = aIsPlayer1 ? { 1: a, 2: b } : { 1: b, 2: a };
  const result = playCpuGame({ level: rules, cpuLevels, seed: 100 + game, maxSteps, startingPlayer: (game >> 1) % 2 ? 2 : 1 });
  steps += result.steps;
  let winner = result.finished ? result.state.winner : result.leader;
  if (result.finished) decided++;
  if (winner === null) { ties++; continue; }
  const aWon = (winner === 1) === aIsPlayer1;
  wins[aWon ? "a" : "b"]++;
}
console.log(`level ${a} vs ${b} (rules ${rules}): ${a} won ${wins.a}, ${b} won ${wins.b}, ties ${ties}; ` +
  `${decided}/${games} games ended by the rules (the rest by tiebreak); ${Math.round(steps / games)} moves a game; ${Math.round((Date.now() - started) / 1000)}s`);
