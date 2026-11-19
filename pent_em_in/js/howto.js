// The "How to play" dialog. It shows docs/rules.md (the same rules document
// the game is built from), stopping before the developer notes at the end.

import { renderMarkdown } from "./markdown.js";

export function setupHowTo({ dialog, content, openButtons, closeButton }) {
  let loaded = false;

  async function load() {
    if (loaded) return;
    try {
      const response = await fetch("docs/rules.md");
      if (!response.ok) throw new Error(response.status);
      content.textContent = "";
      renderMarkdown(content, await response.text(), /^## Implementation notes/);
      loaded = true;
    } catch (error) {
      content.textContent = "The rules couldn't be loaded. They are in docs/rules.md.";
    }
  }

  for (const button of openButtons) {
    button.addEventListener("click", () => {
      load();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
  }
  closeButton.addEventListener("click", () => dialog.close ? dialog.close() : dialog.removeAttribute("open"));
}
