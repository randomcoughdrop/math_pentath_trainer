// The game clock: the game cap (Easy and Medium), the chess clock (Hard), the
// turn alert (Medium and Hard), and pausing.
//
// A clock is plain data, and every function here is told how much time has
// passed (the page measures it), so nothing waits on a real timer and the
// whole thing can be tested instantly. The clock is not part of the game
// state: the rules never look at it. The page tells the game when time is up
// (see callTime and loseOnTime in game.js).

import { BAND_RULES, bandForLevel } from "./constants.js";

// A new clock for a game at this difficulty level.
//   type "cap"   - one shared limit for the whole game (elapsedMs counts up)
//   type "chess" - each player has their own time (remainingMs counts down,
//                  but only for the player whose turn it is)
export function createClock(level) {
  const rules = BAND_RULES[bandForLevel(level)];
  const limitMs = rules.clock.minutes * 60 * 1000;

  return {
    type: rules.clock.type,
    limitMs,
    elapsedMs: 0,
    remainingMs: rules.clock.type === "chess" ? { 1: limitMs, 2: limitMs } : null,
    expired: false, // the game cap has run out (only reported once)
    turnMs: 0, // time spent on the current turn
    turnAlertMs: rules.turnAlertSec === null ? null : rules.turnAlertSec * 1000,
    alerted: false, // the turn alert has gone off this turn
    paused: false,
  };
}

// Let `ms` milliseconds go by while `player` is on the move. Does nothing
// while paused. Returns what happened:
//   { capReached: true }     the game cap ran out (once)
//   { flagFall: player }     that player's chess clock reached zero
//   { turnAlert: true }      the soft turn alert just went off
// `humanTurn` should be false for the computer's turns, which get no alert.
export function advanceClock(clock, ms, player, humanTurn = true) {
  const events = { capReached: false, flagFall: null, turnAlert: false };
  if (clock.paused || ms <= 0) return events;

  clock.elapsedMs += ms;
  clock.turnMs += ms;

  if (clock.type === "cap") {
    if (!clock.expired && clock.elapsedMs >= clock.limitMs) {
      clock.expired = true;
      events.capReached = true;
    }
  } else {
    clock.remainingMs[player] = Math.max(0, clock.remainingMs[player] - ms);
    if (clock.remainingMs[player] === 0) events.flagFall = player;
  }

  if (humanTurn && clock.turnAlertMs !== null && !clock.alerted && clock.turnMs >= clock.turnAlertMs) {
    clock.alerted = true;
    events.turnAlert = true;
  }

  return events;
}

// A turn just ended: start timing the next one.
export function startTurn(clock) {
  clock.turnMs = 0;
  clock.alerted = false;
}

// Pausing stops all the clocks. Paused time counts toward nobody.
export function setPaused(clock, paused) {
  clock.paused = paused;
}

// Milliseconds as "m:ss". Time left counts up to the next whole second (so a
// clock never shows 0:00 while there is still time); time used counts down.
export function formatTime(ms, { remaining = false } = {}) {
  const seconds = remaining ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes + ":" + String(seconds % 60).padStart(2, "0");
}
