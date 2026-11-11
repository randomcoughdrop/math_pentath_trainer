// Who controls each player, and whose input the game is waiting for.
// state.settings.players is { 1: "human"|"cpu", 2: "human"|"cpu" }; older or
// hand-built states without it are two humans.

import { otherPlayer } from "./state.js";
import { actingPlayer, canChallengeWin } from "./challenges.js";

export function controllerOf(state, player) {
  return state.settings.players?.[player] ?? "human";
}

// The player the game is waiting on: whoever must decide after a challenge, or
// the player to move. After the game, the loser if they may challenge the win.
// null when nobody has anything to do.
export function actorNow(state) {
  if (state.phase === "gameover") return canChallengeWin(state) ? otherPlayer(state.winner) : null;
  return actingPlayer(state);
}

export function cpuToAct(state) {
  const actor = actorNow(state);
  return actor !== null && controllerOf(state, actor) === "cpu";
}

export function humanToAct(state) {
  const actor = actorNow(state);
  return actor !== null && controllerOf(state, actor) === "human";
}
