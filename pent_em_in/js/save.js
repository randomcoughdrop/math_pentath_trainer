// Saving a game and taking moves back.
//
// A game is fully described by its settings, who went first, and the list of
// things that happened to it (moves, "time called", "lost on time"). So a save
// is just that list, and the game is rebuilt by replaying it. Undo is the same
// idea: replay all but the last few events.
//
// Event shapes: any move object, { type: "@time" }, { type: "@flag", player }.

import { createInitialState } from "./state.js";
import { applyMove, callTime, loseOnTime } from "./game.js";
import { cpuToAct } from "./players.js";

const SAVE_VERSION = 1;

// Apply one event to a state. Returns the new state, or null if it is refused.
export function applyEvent(state, event) {
  if (event.type === "@time") return callTime(state);
  if (event.type === "@flag") return loseOnTime(state, event.player);
  const result = applyMove(state, event);
  return result.ok ? result.state : null;
}

// Rebuild a game from its start. Returns the state, or null if anything in the
// list can't be replayed (so a damaged save is simply ignored).
export function replayEvents(settings, startingPlayer, events) {
  let state = createInitialState({ ...settings, startingPlayer });
  for (const event of events) {
    state = applyEvent(state, event);
    if (state === null) return null;
  }
  return state;
}

// What to store.
export function buildSave(settings, startingPlayer, events, clock) {
  return { version: SAVE_VERSION, settings, startingPlayer, events, clock };
}

// Is this a usable save? (Checks the shape only; replaying checks the rest.)
export function looksLikeSave(save) {
  return Boolean(save) && save.version === SAVE_VERSION && Boolean(save.settings)
    && [1, 2].includes(save.startingPlayer) && Array.isArray(save.events) && Boolean(save.clock);
}

// How many events to drop to take back the player's last move. Two players on
// one screen: just the last move. Against the computer: back to the last time
// a person was on the move (that is, their own move and the reply to it).
// Returns 0 when there's nothing to undo.
export function undoCount(settings, startingPlayer, events) {
  for (let drop = 1; drop <= events.length; drop++) {
    const state = replayEvents(settings, startingPlayer, events.slice(0, events.length - drop));
    if (state === null) return 0;
    if (!cpuToAct(state) && !events[events.length - drop].type.startsWith("@")) return drop;
  }
  return 0;
}
