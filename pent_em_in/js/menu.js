// The start screen: choose a difficulty and a color set, then start.

import { PRESET_LEVELS, COLOR_SCHEMES } from "./constants.js";

// Turn the menu's choices into game settings. Anything unrecognized falls back
// to Easy and the first color scheme.
export function settingsFromChoices(difficulty, colorScheme) {
  return {
    level: PRESET_LEVELS[difficulty] ?? PRESET_LEVELS.easy,
    colorScheme: Object.hasOwn(COLOR_SCHEMES, colorScheme) ? colorScheme : "red-blue",
  };
}

// Connect the menu.
//   menu    - the menu element (it holds the radio buttons and a Start button)
//   onStart - called with the chosen settings
export function setupMenu({ menu, onStart }) {
  menu.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const choice = (name) => menu.querySelector("input[name=" + name + "]:checked")?.value;
    onStart(settingsFromChoices(choice("difficulty"), choice("colors")));
  });
}

// Pick a radio button by its value, such as selectChoice(menu, "difficulty", "hard").
export function selectChoice(menu, name, value) {
  const radio = menu.querySelector("input[name=" + name + "][value=" + value + "]");
  if (radio) radio.checked = true;
}
