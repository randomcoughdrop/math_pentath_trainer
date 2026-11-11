// Status text, buttons, and the move log (the page, not the canvas).

import { COLOR_SCHEMES, PIECES_PER_PLAYER } from "./constants.js";
import { otherPlayer } from "./state.js";
import { movesForPiece, rotateTurns } from "./input.js";
import { formatTime } from "./clock.js";

// "Player 1 (Red)"
export function playerLabel(state, player) {
  return "Player " + player + " (" + COLOR_SCHEMES[state.settings.colorScheme][player].name + ")";
}

// The sentence shown above the board. Pure: it only builds text.
//   view    - { held, hover, notice, announce, selected, action, pivot } (see input.js)
//   preview - the placement ghost, or null (see computePreview in input.js)
//   legal   - the current player's legal moves (movement phase)
export function statusMessage(state, view, preview, legal = []) {
  if (state.phase === "gameover") {
    const { title, detail } = gameOverSummary(state);
    return title + " " + detail;
  }

  const message = turnMessage(state, view, preview, legal);
  if (!state.timeCalled) return message;

  // The game cap ran out: say how the game will end.
  return "Time is up! The game ends after " + playerLabel(state, state.timeEndsAfter) + "'s turn. " + message;
}

function turnMessage(state, view, preview, legal) {
  if (state.phase === "movement") return movementMessage(state, view, legal);

  const player = state.currentPlayer;
  const who = playerLabel(state, player);
  let message;

  if (!view.held) {
    const number = state.placedCount[player] + 1;
    message = who + ": choose a piece from your tray (piece " + number + " of " + PIECES_PER_PLAYER + ").";
  } else if (preview && !preview.ok) {
    message = who + ": " + preview.message;
  } else if (preview) {
    message = who + ": click to place the " + view.held.shape + " here (on a touch screen, tap the same square again or press Place).";
  } else {
    message = who + ": move over the board to place the " + view.held.shape + ". R rotates, F flips, Esc cancels.";
  }

  if (view.notice && !preview) message = view.notice + " " + message;

  // On the very first turn, say who won the random draw.
  if (state.moveLog.length === 0 && !view.held && view.announce) {
    message = view.announce + " " + message;
  }

  return message;
}

// What to show when the game is over: a headline and the reason.
export function gameOverSummary(state) {
  if (state.winner === null) {
    return { title: "It's a tie!", detail: "Time ran out and nobody had won." };
  }

  const loser = otherPlayer(state.winner);
  const title = playerLabel(state, state.winner) + " wins!";

  if (state.winReason === "placement") {
    return { title, detail: playerLabel(state, loser) + " can't place any more pieces." };
  }
  if (state.winReason === "entrapment") {
    return { title, detail: "All of " + playerLabel(state, loser) + "'s pieces are trapped." };
  }
  if (state.winReason === "time") {
    return { title, detail: playerLabel(state, loser) + " ran out of time on their clock." };
  }
  return { title, detail: "" };
}

function movementMessage(state, view, legal) {
  const who = playerLabel(state, state.currentPlayer);
  const selected = view.selected;
  let message;

  if (!selected) {
    message = who + ": click one of your pieces or chips to move it.";
  } else if (selected.kind === "chip") {
    message = who + ": click a marked square to move the chip there.";
  } else {
    const piece = state.pieces.find((candidate) => candidate.id === selected.id);
    const name = "the " + piece.shape;

    if (movesForPiece(legal, piece.id).length === 0) {
      message = who + ": " + name + " has no legal move right now. Pick another piece or a chip.";
    } else if (view.action === "slide") {
      message = who + ": click a marked square to slide " + name + " there, or choose Rotate or Flip.";
    } else if (view.action === "rotate" && !view.pivot) {
      message = who + ": click a marked corner to rotate " + name + " around.";
    } else if (view.action === "rotate") {
      const turns = rotateTurns(legal, piece.id, view.pivot);
      message = who + ": choose how far to turn " + name + " (" + turns.map((q) => q * 90 + "°").join(", ") + ").";
    } else {
      message = who + ": click a see-through copy to flip " + name + " that way.";
    }

    const streak = state.repeat[state.currentPlayer];
    if (streak.pieceId === piece.id && streak.count >= 2) {
      message += " (It has moved twice in a row, so it has to stay put this turn.)";
    }
  }

  if (view.notice) message = view.notice + " " + message;
  return message;
}

// ---------------------------------------------------------------------------
// The move log
// ---------------------------------------------------------------------------

// One entry of state.moveLog as a sentence. Rows and columns count from 1,
// like the rules do.
export function describeEntry(state, entry) {
  const who = playerLabel(state, entry.player);

  if (entry.type === "place") return who + " placed the " + entry.shape + ".";
  if (entry.type === "slide") return who + " slid the " + entry.shape + " " + entry.direction + " " + entry.distance + ".";
  if (entry.type === "flip") return who + " flipped the " + entry.shape + " over its " + entry.side + " side.";
  if (entry.type === "rotate") {
    return who + " rotated the " + entry.shape + " " + entry.quarterTurns * 90 + "° clockwise around the " +
      cornerName(entry.from, entry.pivot) + ".";
  }
  if (entry.type === "chip") {
    return who + " moved a chip from row " + (entry.from.row + 1) + ", col " + (entry.from.col + 1) +
      " to row " + (entry.to.row + 1) + ", col " + (entry.to.col + 1) + ".";
  }
  return who + " made a move.";
}

// Say which corner a pivot is, such as "top-left corner of row 3, col 5" (the
// square of the piece that touches it).
function cornerName(cells, pivot) {
  const [row, col] = pivot;
  const candidates = [
    { cell: [row, col], name: "top-left" },
    { cell: [row, col - 1], name: "top-right" },
    { cell: [row - 1, col], name: "bottom-left" },
    { cell: [row - 1, col - 1], name: "bottom-right" },
  ];
  const found = candidates.find(({ cell }) => cells.some(([r, c]) => r === cell[0] && c === cell[1]));
  if (!found) return "corner at row line " + row + ", col line " + col;
  return found.name + " corner of row " + (found.cell[0] + 1) + ", col " + (found.cell[1] + 1);
}

// Rebuild the numbered list from the state's move log.
export function renderLog(list, state) {
  list.textContent = "";
  for (const entry of state.moveLog) {
    const item = document.createElement("li");
    item.textContent = describeEntry(state, entry);
    list.appendChild(item);
  }
  // Keep the newest move in view.
  if (list.parentElement) list.parentElement.scrollTop = list.parentElement.scrollHeight;
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

// Turn buttons on or off, show the right set for the phase, and highlight
// whose tray it is to use.
//   buttons   - every button (see index.html)
//   panels    - { placement, movement, trays } the containers to show or hide
//   trayBoxes - { 1: element, 2: element } the containers around each tray
export function updateControls(state, view, preview, legal, buttons, panels, trayBoxes) {
  const placing = state.phase === "placement";
  const moving = state.phase === "movement";

  panels.placement.hidden = !placing;
  panels.movement.hidden = !moving;
  panels.trays.hidden = !placing;

  // Placement
  const holding = placing && Boolean(view.held);
  buttons.rotateLeft.disabled = !holding;
  buttons.rotateRight.disabled = !holding;
  buttons.flip.disabled = !holding;
  buttons.cancel.disabled = !holding;
  buttons.place.disabled = !(preview && preview.ok);

  // Movement
  const selected = moving ? view.selected : null;
  const pieceSelected = Boolean(selected && selected.kind === "piece");
  buttons.slideAction.disabled = !pieceSelected;
  buttons.rotateAction.disabled = !pieceSelected;
  buttons.flipAction.disabled = !pieceSelected;
  buttons.slideAction.classList.toggle("active", pieceSelected && view.action === "slide");
  buttons.rotateAction.classList.toggle("active", pieceSelected && view.action === "rotate");
  buttons.flipAction.classList.toggle("active", pieceSelected && view.action === "flip");

  const turns = pieceSelected && view.pivot ? rotateTurns(legal, selected.id, view.pivot) : [];
  buttons.turn90.disabled = !turns.includes(1);
  buttons.turn180.disabled = !turns.includes(2);
  buttons.turn270.disabled = !turns.includes(3);
  buttons.moveCancel.disabled = !selected;

  for (const player of [1, 2]) {
    trayBoxes[player].classList.toggle("active", placing && state.currentPlayer === player);
  }
}

// ---------------------------------------------------------------------------
// Clocks
// ---------------------------------------------------------------------------

// Show the clocks.
//   parts - the page's elements: { game, player1, player2, turn, pause, sound }
//   clock - the clock (see clock.js)
export function renderClocks(parts, state, clock) {
  const chess = clock.type === "chess";

  parts.game.hidden = chess;
  parts.player1.hidden = !chess;
  parts.player2.hidden = !chess;
  parts.turn.hidden = clock.turnAlertMs === null;
  parts.sound.hidden = clock.turnAlertMs === null; // there is no reminder to beep for

  if (chess) {
    for (const player of [1, 2]) {
      const part = parts["player" + player];
      part.textContent = playerLabel(state, player) + ": " + formatTime(clock.remainingMs[player], { remaining: true });
      part.classList.toggle("running", state.phase !== "gameover" && !clock.paused && state.currentPlayer === player);
    }
  } else {
    parts.game.textContent = "Game time: " + formatTime(Math.min(clock.elapsedMs, clock.limitMs)) +
      " of " + formatTime(clock.limitMs);
  }

  parts.turn.textContent = "This turn: " + formatTime(clock.turnMs);
  parts.turn.classList.toggle("alert", clock.alerted && state.phase !== "gameover");

  parts.pause.textContent = clock.paused ? "Resume" : "Pause";
  parts.pause.disabled = state.phase === "gameover";
}
