// The challenge parts of the page: the Challenge button and its list of rules,
// the strike counter, the choice buttons after a challenge, and the button
// for challenging a win.

import { CHALLENGE_CATEGORIES, STRIKES_TO_LOSE, canChallenge, canChallengeWin } from "./challenges.js";
import { challengesEnabled } from "./rules.js";
import { playerLabel, decisionLabel } from "./ui.js";

// Connect the buttons. The list of rules is built once, from CHALLENGE_CATEGORIES.
//   parts    - the page's elements (see main.js)
//   view     - the temporary state (view.challengeOpen says the list is showing)
//   onMove   - tries to play a move; returns { ok, message }
//   onChange - redraw
export function setupChallengeUI({ parts, view, onMove, onChange }) {
  for (const category of CHALLENGE_CATEGORIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = category.label;
    button.addEventListener("click", () => {
      view.challengeOpen = false;
      const result = onMove({ type: "challenge", category: category.id });
      view.notice = result.ok ? "" : result.message;
      onChange();
    });
    parts.list.appendChild(button);
  }

  parts.open.addEventListener("click", () => {
    view.challengeOpen = !view.challengeOpen;
    onChange();
  });
  parts.cancel.addEventListener("click", () => {
    view.challengeOpen = false;
    onChange();
  });

  // The choice buttons are rebuilt each time, so one handler covers them all.
  parts.decisionButtons.addEventListener("click", (event) => {
    const choice = event.target.dataset && event.target.dataset.choice;
    if (!choice) return;
    const result = onMove({ type: "decide", choice });
    view.notice = result.ok ? "" : result.message;
    onChange();
  });

  parts.winButton.addEventListener("click", () => {
    const result = onMove({ type: "challenge-win" });
    view.notice = result.ok ? "" : result.message;
    onChange();
  });
}

// Show or hide each part for the current state.
export function renderChallengeUI(parts, state, view) {
  const enabled = challengesEnabled(state) && state.phase !== "gameover";
  const available = canChallenge(state);

  parts.bar.hidden = !enabled;
  parts.open.disabled = !available;
  parts.strikes.textContent = "Incorrect challenges: " +
    [1, 2].map((player) => playerLabel(state, player) + " " + state.strikes[player] + " of " + STRIKES_TO_LOSE).join(" · ");

  // The list of rules, only while it makes sense.
  if (!available) view.challengeOpen = false;
  parts.panel.hidden = !view.challengeOpen;

  // The choice after a challenge on a movement rule.
  const choosing = state.pending && state.pending.kind === "choose";
  parts.decision.hidden = !choosing;
  parts.decisionButtons.textContent = "";
  if (choosing) {
    for (const choice of state.pending.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.choice = choice;
      button.textContent = decisionLabel(state, choice);
      parts.decisionButtons.appendChild(button);
    }
  }

  // Challenging a declared win, after the game.
  parts.win.hidden = !canChallengeWin(state);
}
