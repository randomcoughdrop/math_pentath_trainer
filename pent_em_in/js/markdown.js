// A very small Markdown-to-DOM converter, just enough for docs/rules.md:
// headings, paragraphs, bullet and numbered lists, tables, **bold**, *italic*
// and `code`. It builds DOM elements (never HTML strings), so nothing in the
// text can inject markup.

// Text with inline styling, added to `parent`.
export function addInline(parent, text) {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  for (const piece of text.split(pattern)) {
    if (!piece) continue;
    let element = null;
    if (piece.startsWith("**") && piece.endsWith("**") && piece.length > 4) {
      element = document.createElement("strong");
      element.textContent = piece.slice(2, -2);
    } else if (piece.startsWith("`") && piece.endsWith("`") && piece.length > 2) {
      element = document.createElement("code");
      element.textContent = piece.slice(1, -1);
    } else if (piece.startsWith("*") && piece.endsWith("*") && piece.length > 2) {
      element = document.createElement("em");
      element.textContent = piece.slice(1, -1);
    }
    parent.append(element ?? document.createTextNode(piece));
  }
}

// Which block a line belongs to.
function kindOf(line) {
  if (/^#{1,6} /.test(line)) return "heading";
  if (/^\s*[-*] /.test(line)) return "bullet";
  if (/^\s*\d+\. /.test(line)) return "number";
  if (line.startsWith("|")) return "table";
  if (line.trim() === "") return "blank";
  return "paragraph";
}

// Turn Markdown text into DOM elements inside `root`. Stops at the first line
// matching `stopAt` (a regular expression), if given.
export function renderMarkdown(root, markdown, stopAt = null) {
  const lines = markdown.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (stopAt && stopAt.test(line)) break;
    const kind = kindOf(line);

    if (/^---+$/.test(line.trim())) {
      root.append(document.createElement("hr"));
      i++;
    } else if (kind === "blank") {
      i++;
    } else if (kind === "heading") {
      const level = Math.min(line.match(/^#+/)[0].length + 1, 6); // the dialog already has an h1
      const heading = document.createElement("h" + level);
      addInline(heading, line.replace(/^#+ /, ""));
      root.append(heading);
      i++;
    } else if (kind === "bullet" || kind === "number") {
      const list = document.createElement(kind === "bullet" ? "ul" : "ol");
      while (i < lines.length && kindOf(lines[i]) === kind) {
        const item = document.createElement("li");
        addInline(item, lines[i].replace(/^\s*([-*]|\d+\.) /, ""));
        list.append(item);
        i++;
      }
      root.append(list);
    } else if (kind === "table") {
      const rows = [];
      while (i < lines.length && kindOf(lines[i]) === "table") {
        if (!/^\|[\s|:-]+\|?$/.test(lines[i])) rows.push(lines[i].split("|").slice(1, -1).map((cell) => cell.trim()));
        i++;
      }
      const table = document.createElement("table");
      rows.forEach((cells, index) => {
        const tr = document.createElement("tr");
        for (const text of cells) {
          const cell = document.createElement(index === 0 ? "th" : "td");
          addInline(cell, text);
          tr.append(cell);
        }
        table.append(tr);
      });
      root.append(table);
    } else {
      const paragraph = document.createElement("p");
      const parts = [];
      while (i < lines.length && kindOf(lines[i]) === "paragraph" && !/^---+$/.test(lines[i].trim()) && !(stopAt && stopAt.test(lines[i]))) {
        parts.push(lines[i].trim());
        i++;
      }
      addInline(paragraph, parts.join(" "));
      root.append(paragraph);
    }
  }
}
