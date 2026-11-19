// Status text, buttons, and the move log (the page, not the canvas).

import { COLOR_SCHEMES, PIECES_PER_PLAYER, bandForLevel } from "./constants.js";
import { otherPlayer } from "./state.js";
import { movesForPiece, rotateTurns, isPlacingNow, placementOwner, usesFreeMoves } from "./input.js";
import { formatTime } from "./clock.js";
import { CHALLENGE_CATEGORIES } from "./challenges.js";
import { challengesEnabled, blocksViolations } from "./rules.js";
import { controllerOf, cpuToAct, actorNow } from "./players.js";

// "Player 1 (Red)"
export function playerLabel(state, player) {
  const color = COLOR_SCHEMES[state.settings.colorScheme][player].name;
  return (controllerOf(state, player) === "cpu" ? "Computer" : "Player " + player) + " (" + color + ")";
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

  const message = cpuToAct(state)
    ? playerLabel(state, actorNow(state)) + " is thinking..."
    : turnMessage(state, view, preview, legal);
  if (!state.timeCalled) return message;

  // The game cap ran out: say how the game will end.
  return "Time is up! The game ends after " + playerLabel(state, state.timeEndsAfter) + "'s turn. " + message;
}

function turnMessage(state, view, preview, legal) {
  if (state.pending && state.pending.kind !== "place-for") return pendingMessage(state, view);
  if (state.phase === "movement") return movementMessage(state, view, legal);

  // Placing a piece: your own, or (after a correct challenge) one for the opponent.
  const player = placementOwner(state);
  const placer = state.pending ? state.pending.chooser : player;
  const who = playerLabel(state, placer);
  if (state.pending && !view.held) {
    return who + ": your challenge was correct. Choose one of " + playerLabel(state, player) +
      "'s pieces from their tray and place it for them, without breaking a rule.";
  }
  let message;

  if (!view.held) {
    const number = state.placedCount[player] + 1;
    message = who + ": choose a piece from your tray (piece " + number + " of " + PIECES_PER_PLAYER + ").";
  } else if (preview && !preview.ok && !preview.plain) {
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

  const stands = state.winChallenged ? " The challenge to the win was incorrect, so it stands." : "";
  if (state.winReason === "placement") {
    return { title, detail: playerLabel(state, loser) + " can't place any more pieces." + stands };
  }
  if (state.winReason === "entrapment") {
    return { title, detail: "All of " + playerLabel(state, loser) + "'s pieces are trapped." + stands };
  }
  if (state.winReason === "time") {
    return { title, detail: playerLabel(state, loser) + " ran out of time on their clock." };
  }
  if (state.winReason === "strikes") {
    return { title, detail: playerLabel(state, loser) + " made three incorrect challenges." };
  }
  if (state.winReason === "three-in-a-row") {
    return { title, detail: playerLabel(state, loser) + " moved the same piece three turns in a row, and " + playerLabel(state, state.winner) + " challenged it." };
  }
  if (state.winReason === "declared-win") {
    return { title, detail: playerLabel(state, loser) + "'s winning move broke a rule, and " + playerLabel(state, state.winner) + " challenged it correctly." };
  }
  return { title, detail: "" };
}

// The prompt while a challenge waits for someone's choice (not the placing step).
function pendingMessage(state, view) {
  const pending = state.pending;
  const chooser = playerLabel(state, pending.chooser);
  let message;

  if (pending.kind === "move-chip") {
    message = playerLabel(state, pending.challenger) + "'s challenge was incorrect (strike " + state.strikes[pending.challenger] +
      " of 3). " + chooser + ": move one of " + playerLabel(state, pending.challenger) +
      "'s chips to a new empty square. Click the chip, then the square.";
  } else if (pending.outcome === "correct") {
    message = playerLabel(state, pending.challenger) + "'s challenge was correct, and the move was undone. " + chooser + ": choose what happens next.";
  } else {
    message = playerLabel(state, pending.challenger) + "'s challenge was incorrect (strike " + state.strikes[pending.challenger] +
      " of 3). " + chooser + ": choose what happens next.";
  }

  return view.notice ? view.notice + " " + message : message;
}

// The words on a button for one of the choices after a challenge.
export function decisionLabel(state, choice) {
  const { challenger, offender } = state.pending;
  if (choice === "take-turn") return "Take my turn";
  if (choice === "lose-turn") return "Make " + playerLabel(state, challenger) + " lose the turn";
  // "force-move": whoever has to move depends on how the challenge came out.
  const forced = state.pending.outcome === "correct" ? offender : challenger;
  return "Move one of " + playerLabel(state, forced) + "'s pentominoes";
}

// Quarter turns are named 90°, 180°, and -90° (a turn the other way).
function turnLabel(quarterTurns) {
  return quarterTurns === 3 ? "-90°" : quarterTurns * 90 + "°";
}

function movementMessage(state, view, legal) {
  // After a challenge, the challenge winner chooses a move for the other player's piece.
  const who = state.forcedBy
    ? playerLabel(state, state.forcedBy) + " (moving " + playerLabel(state, state.currentPlayer) + "'s piece)"
    : playerLabel(state, state.currentPlayer);
  const selected = view.selected;
  let message;

  if (!selected) {
    message = state.forcedBy
      ? who + ": click one of that player's pentominoes to move it."
      : who + ": click one of your pieces or chips to move it.";
  } else if (selected.kind === "chip") {
    message = who + ": click a marked square to move the chip there.";
  } else {
    const piece = state.pieces.find((candidate) => candidate.id === selected.id);
    const name = "the " + piece.shape;

    if (movesForPiece(legal, piece.id).length === 0) {
      message = who + ": " + name + " has no legal move right now. Pick another piece" + (state.forcedBy ? "." : " or a chip.");
    } else if (view.free) {
      message = who + ": move " + name + " where you want it. R turns it, F flips it, click to drop it. Click another piece or chip of yours to switch to it, or press Esc to put it back.";
    } else if (view.action === "slide") {
      message = who + ": click a marked square to slide " + name + " there, or choose Rotate or Flip.";
    } else if (view.action === "rotate" && !view.pivot) {
      message = who + ": click a marked corner to rotate " + name + " around.";
    } else if (view.action === "rotate") {
      const turns = rotateTurns(legal, piece.id, view.pivot);
      message = who + ": choose how far to turn " + name + " (" + turns.map(turnLabel).join(", ") + ").";
    } else {
      message = who + ": click a see-through copy to flip " + name + " that way.";
    }

    const streak = state.repeat[state.currentPlayer];
    if (streak.pieceId === piece.id && streak.count >= 2 && bandForLevel(state.settings.level) !== "hard") {
      message += challengesEnabled(state)
        ? " (It has moved twice in a row. Moving it again breaks the three-in-a-row rule.)"
        : " (It has moved twice in a row, so it has to stay put this turn.)";
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

  if (entry.type === "place" && entry.placedBy) {
    return playerLabel(state, entry.placedBy) + " placed the " + entry.shape + " for " + who + ".";
  }
  if (entry.type === "place") return who + " placed the " + entry.shape + ".";
  if (entry.forcedBy) {
    return playerLabel(state, entry.forcedBy) + " moved " + who + "'s " + entry.shape + " (" + entry.type + ").";
  }
  if (entry.type === "slide") return who + " slid the " + entry.shape + " " + entry.direction + " " + entry.distance + ".";
  if (entry.type === "flip") return who + " flipped the " + entry.shape + " over its " + entry.side + " side.";
  if (entry.type === "rotate") {
    return who + " rotated the " + entry.shape + " " + (entry.quarterTurns === 3 ? "90° counterclockwise" : entry.quarterTurns * 90 + "° clockwise") + " around the " +
      cornerName(entry.from, entry.pivot) + ".";
  }
  if (entry.type === "challenge") {
    const rule = CHALLENGE_CATEGORIES.find((category) => category.id === entry.category).label.toLowerCase();
    return who + " challenged: " + rule + ". " +
      (entry.correct ? "Correct (C)." : "Incorrect (I), strike " + entry.strike + " of 3.");
  }
  if (entry.type === "decision") {
    const other = playerLabel(state, entry.player === entry.challenger ? entry.offender : entry.challenger);
    if (entry.choice === "take-turn") return who + " chose to take a turn.";
    if (entry.choice === "lose-turn") return who + " made " + other + " lose the turn.";
    return who + " made " + (entry.outcome === "correct" ? playerLabel(state, entry.offender) : playerLabel(state, entry.challenger)) + " move a pentomino.";
  }
  if (entry.type === "relocate-chip") {
    return who + " moved a chip from row " + (entry.from.row + 1) + ", col " + (entry.from.col + 1) +
      " to row " + (entry.to.row + 1) + ", col " + (entry.to.col + 1) + ".";
  }
  if (entry.type === "challenge-win") {
    return who + " challenged the win. " + (entry.correct ? "Correct (C): the winning move broke a rule." : "Incorrect (I): the win stands.");
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

// What one log entry looks like in its player's column: { text, kind }.
// A move is just the letter of the piece (O for a chip). The few other events
// get a short word, and the full sentence is always in the hover text.
export function logCell(entry) {
  if (["place", "slide", "flip", "rotate"].includes(entry.type)) return { text: entry.shape, kind: "move" };
  if (entry.type === "chip" || entry.type === "relocate-chip") return { text: "O", kind: "move" };
  if (entry.type === "challenge") return { text: entry.correct ? "challenge ✓" : "challenge ✗", kind: "event" };
  if (entry.type === "challenge-win") return { text: entry.correct ? "win challenge ✓" : "win challenge ✗", kind: "event" };
  if (entry.type === "decision") {
    const text = entry.choice === "take-turn" ? "took turn"
      : entry.choice === "lose-turn" ? "other loses turn" : "forced piece move";
    return { text, kind: "event" };
  }
  return { text: "?", kind: "event" };
}

// Rebuild the move log: a table with one column per player, each listing that
// player's moves in order.
export function renderLog(table, state) {
  table.textContent = "";

  const head = table.createTHead().insertRow();
  for (const player of [1, 2]) {
    const heading = document.createElement("th");
    heading.scope = "col";
    heading.textContent = playerLabel(state, player);
    head.appendChild(heading);
  }

  const columns = { 1: [], 2: [] };
  for (const entry of state.moveLog) columns[entry.player].push(entry);

  const body = table.createTBody();
  const rows = Math.max(columns[1].length, columns[2].length);
  for (let i = 0; i < rows; i++) {
    const row = body.insertRow();
    for (const player of [1, 2]) {
      const cell = row.insertCell();
      const entry = columns[player][i];
      if (!entry) continue;
      const { text, kind } = logCell(entry);
      cell.textContent = text;
      cell.className = kind;
      cell.title = describeEntry(state, entry);
    }
  }

  table.dataset.count = String(state.moveLog.length);
  // Keep the newest move in view.
  if (table.parentElement) table.parentElement.scrollTop = table.parentElement.scrollHeight;
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
  const placing = isPlacingNow(state);
  const moving = state.phase === "movement" && !state.pending;

  // On Hard the movement phase uses the placement buttons: the piece is moved freely.
  const free = moving && usesFreeMoves(state);

  panels.placement.hidden = !(placing || free);
  panels.movement.hidden = !moving || free;
  panels.trays.hidden = !placing;

  // Placement (and free moves on Hard)
  const holding = (placing && Boolean(view.held)) || (free && Boolean(view.free));
  buttons.rotateLeft.disabled = !holding;
  buttons.rotateRight.disabled = !holding;
  buttons.flip.disabled = !holding;
  buttons.cancel.disabled = !(holding || (free && Boolean(view.selected)));
  buttons.place.disabled = !(preview && (preview.ok || preview.plain));
  buttons.place.textContent = free ? "Move here" : "Place";

  // Movement
  const selected = moving ? view.selected : null;
  const pieceSelected = Boolean(selected && selected.kind === "piece");
  buttons.slideAction.disabled = !pieceSelected;
  // On Easy, rotate and flip are greyed out when the piece has no legal turn or flip.
  const easy = blocksViolations(state);
  const canDo = (type) => !easy || legal.some((move) => move.pieceId === selected.id && move.type === type);
  buttons.rotateAction.disabled = !pieceSelected || !canDo("rotate");
  buttons.flipAction.disabled = !pieceSelected || !canDo("flip");
  buttons.slideAction.classList.toggle("active", pieceSelected && view.action === "slide");
  buttons.rotateAction.classList.toggle("active", pieceSelected && view.action === "rotate");
  buttons.flipAction.classList.toggle("active", pieceSelected && view.action === "flip");

  const turns = pieceSelected && view.pivot ? rotateTurns(legal, selected.id, view.pivot) : [];
  buttons.turn90.disabled = !turns.includes(1);
  buttons.turn180.disabled = !turns.includes(2);
  buttons.turn270.disabled = !turns.includes(3);
  buttons.moveCancel.disabled = !selected;

  for (const player of [1, 2]) {
    trayBoxes[player].classList.toggle("active", placing && placementOwner(state) === player);
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
      part.classList.toggle("running", state.phase !== "gameover" && !clock.paused && (state.forcedBy ?? state.currentPlayer) === player);
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
