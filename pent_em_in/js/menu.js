// The start screen: choose a difficulty and a color set, then start.

import { PRESET_LEVELS, COLOR_SCHEMES } from "./constants.js";

// Turn the menu's choices into game settings. Anything unrecognized falls back
// to Easy and the first color scheme.
// players is "2" or "cpu"; first is "random", "you", or "computer" (only used
// against the computer). Against the computer you are Player 1.
export function settingsFromChoices(difficulty, colorScheme, players = "2", first = "random") {
  const vsComputer = players === "cpu";
  return {
    level: PRESET_LEVELS[difficulty] ?? PRESET_LEVELS.easy,
    colorScheme: Object.hasOwn(COLOR_SCHEMES, colorScheme) ? colorScheme : "red-blue",
    players: vsComputer ? { 1: "human", 2: "cpu" } : { 1: "human", 2: "human" },
    firstPlayer: vsComputer && first === "you" ? 1 : vsComputer && first === "computer" ? 2 : null, // null: random draw
  };
}

// Connect the menu.
//   menu    - the menu element (it holds the radio buttons and a Start button)
//   onStart - called with the chosen settings
export function setupMenu({ menu, onStart }) {
  menu.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const choice = (name) => menu.querySelector("input[name=" + name + "]:checked")?.value;
    onStart(settingsFromChoices(choice("difficulty"), choice("colors"), choice("players"), choice("first")));
  });

  // "Who goes first" only matters against the computer.
  const firstChoice = menu.querySelector("#first-choice");
  const showFirst = () => {
    firstChoice.hidden = menu.querySelector("input[name=players]:checked")?.value !== "cpu";
  };
  menu.querySelectorAll("input[name=players]").forEach((radio) => radio.addEventListener("change", showFirst));
  showFirst();
}

// Pick a radio button by its value, such as selectChoice(menu, "difficulty", "hard").
export function selectChoice(menu, name, value) {
  const radio = menu.querySelector("input[name=" + name + "][value=" + value + "]");
  if (radio) radio.checked = true;
}
