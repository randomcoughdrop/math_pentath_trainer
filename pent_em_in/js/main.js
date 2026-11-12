// Entry point: wires everything together.

import { createInitialState } from "./state.js";
import { applyMove, callTime, loseOnTime } from "./game.js";
import { createClock, advanceClock, startTurn, setPaused } from "./clock.js";
import { render, renderTray } from "./renderer.js";
import { setupInput, computePreview, buildOverlay, clearSelection, playableMovesFor, placementOwner } from "./input.js";
import { playerLabel, statusMessage, updateControls, renderLog, renderClocks, gameOverSummary } from "./ui.js";
import { setupMenu, selectChoice } from "./menu.js";
import { setupChallengeUI, renderChallengeUI } from "./challenge-ui.js";
import { cpuToAct, actorNow } from "./players.js";
import { cpuParams } from "./ai/params.js";
import { nextCpuMove } from "./ai/cpu.js";

// --- the page's elements ---

const $ = (id) => document.getElementById(id);

const menu = $("menu");
const gameScreen = $("game");
const gameView = $("game-view"); // everything that is hidden while paused
const board = $("board");
const trays = { 1: $("tray-1"), 2: $("tray-2") };
const trayBoxes = { 1: $("tray-box-1"), 2: $("tray-box-2") };
const status = $("status");
const moveLog = $("move-log");
const gameOverBox = $("gameover");
const pauseBanner = $("pause-banner");
const soundToggle = $("sound-toggle");

const buttons = {
  // placement
  rotateLeft: $("btn-rotate-left"),
  rotateRight: $("btn-rotate-right"),
  flip: $("btn-flip"),
  place: $("btn-place"),
  cancel: $("btn-cancel"),
  // movement
  slideAction: $("btn-slide"),
  rotateAction: $("btn-rotate"),
  flipAction: $("btn-flip-piece"),
  turn90: $("btn-turn-90"),
  turn180: $("btn-turn-180"),
  turn270: $("btn-turn-270"),
  moveCancel: $("btn-move-cancel"),
};
// The groups of controls that show in each phase.
const panels = {
  placement: $("placement-controls"),
  movement: $("movement-controls"),
  trays: $("trays"),
};
const challengeParts = {
  bar: $("challenge-bar"),
  open: $("btn-challenge"),
  strikes: $("strikes"),
  panel: $("challenge-panel"),
  list: $("challenge-list"),
  cancel: $("btn-challenge-cancel"),
  decision: $("decision-panel"),
  decisionButtons: $("decision-buttons"),
  win: $("gameover-challenge"),
  winButton: $("btn-challenge-win"),
};
const clockParts = {
  game: $("clock-game"),
  player1: $("clock-player-1"),
  player2: $("clock-player-2"),
  turn: $("clock-turn"),
  pause: $("btn-pause"),
  sound: $("sound-option"),
};

// --- the current game ---

let state = null; // the game (null while the menu is showing)
let clock = null; // the clocks (not part of the game state)
let settings = null; // what the menu chose, kept for "Play again"
let cpu = null; // the computer's settings (from the level), see ai/params.js
let cpuTimer = null;

// Things that are not part of the game itself: the piece being held, where the
// cursor is, short messages, and whether the game is paused.
const view = {};
function resetView() {
  Object.assign(view, {
    held: null, hover: null, notice: "", announce: "",
    selected: null, action: "slide", pivot: null, turnPreview: null,
    paused: false, challengeOpen: false, cpuHighlight: null,
  });
}
resetView();

// Handy for checking things: add ?first=2, ?colors=yellow-green, or
// ?difficulty=hard to the address. (?first only applies to the first game.)
const params = new URLSearchParams(window.location.search);
let firstOverride = ["1", "2"].includes(params.get("first")) ? Number(params.get("first")) : null;
// ?level=0-100 sets the difficulty dial directly (the buttons only offer three
// presets); ?players=cpu starts with the computer selected.
const levelOverride = params.has("level") && Number.isFinite(Number(params.get("level"))) ? Number(params.get("level")) : null;
selectChoice(menu, "players", params.get("players"));
selectChoice(menu, "colors", params.get("colors"));
selectChoice(menu, "difficulty", params.get("difficulty"));

function startGame(chosen) {
  // The digital version of the Game Monitor's hidden-chip draw.
  const startingPlayer = firstOverride ?? chosen.firstPlayer ?? (Math.random() < 0.5 ? 1 : 2);
  firstOverride = null;

  if (levelOverride !== null) chosen = { ...chosen, level: Math.min(100, Math.max(0, levelOverride)) };
  settings = chosen;
  state = createInitialState({ ...chosen, startingPlayer });
  clock = createClock(chosen.level);
  cpu = cpuParams(chosen.level);
  clearTimeout(cpuTimer);
  cpuTimer = null;
  resetView();
  view.announce = "Random draw: " + playerLabel(state, startingPlayer) + " goes first.";

  for (const player of [1, 2]) {
    $("tray-title-" + player).textContent = playerLabel(state, player);
  }
  renderLog(moveLog, state); // new column headings and an empty log

  menu.hidden = true;
  gameScreen.hidden = false;
  lastTick = performance.now();
  draw();
}

function showMenu() {
  state = null;
  clearTimeout(cpuTimer);
  cpuTimer = null;
  gameScreen.hidden = true;
  menu.hidden = false;
}

// --- drawing ---

function draw() {
  if (!state) return;

  const preview = computePreview(state, view.held, view.hover);
  const legal = playableMovesFor(state);

  // While paused the board is hidden, so nothing can be studied.
  gameView.hidden = view.paused;
  pauseBanner.hidden = !view.paused;

  if (!view.paused) {
    render(board, state, { preview, highlightCells: view.cpuHighlight, ...buildOverlay(state, view, legal) });
    for (const player of [1, 2]) {
      // Only the player whose piece is being placed can hold one.
      renderTray(trays[player], state, player, placementOwner(state) === player ? view.held : null);
    }
  }

  status.textContent = statusMessage(state, view, preview, legal);
  updateControls(state, view, preview, legal, buttons, panels, trayBoxes);

  // Only rebuild the log when it has changed.
  if (moveLog.dataset.count !== String(state.moveLog.length)) renderLog(moveLog, state);

  gameOverBox.hidden = state.phase !== "gameover";
  if (state.phase === "gameover") {
    const { title, detail } = gameOverSummary(state);
    $("gameover-title").textContent = title;
    $("gameover-detail").textContent = detail;
  }

  renderChallengeUI(challengeParts, state, view);
  renderClocks(clockParts, state, clock);
  scheduleCpu();
}

// --- playing ---

// Called by the input code when a person tries to make a move.
function handleMove(move) {
  if (cpuToAct(state)) return { ok: false, message: "Wait for the computer." };
  view.cpuHighlight = null;
  return playMove(move);
}

// Plays a move for whoever is acting (a person, or the computer below).
function playMove(move) {
  const result = applyMove(state, move);
  if (result.ok) {
    state = result.state;
    view.held = null;
    view.hover = null;
    clearSelection(view);
    view.challengeOpen = false;
    startTurn(clock); // the next player's turn timer starts at zero
  }
  return result;
}

// --- the computer's turns ---

const CPU_DELAY_MS = 500; // so its moves can be followed

// The squares to highlight so you can see what the computer just did.
function squaresOf(move, after) {
  if (move.type === "place") return move.cells;
  if (move.type === "chip" || move.type === "relocate-chip") return [[move.to.row, move.to.col]];
  const piece = after.pieces.find((candidate) => candidate.id === move.pieceId);
  return piece ? piece.cells : null;
}

// If it is the computer's turn to act, wait a moment and then act. Called after
// every redraw; the timer makes sure only one move is waiting at a time.
function scheduleCpu() {
  if (!state || view.paused || cpuTimer !== null || !cpuToAct(state)) return;
  const waitingOn = state;
  cpuTimer = setTimeout(() => {
    cpuTimer = null;
    if (state !== waitingOn || view.paused) return draw();
    const move = nextCpuMove(state, cpu);
    if (move === null) {
      // Nothing to do (for example, it chooses not to challenge a win). Stop asking.
      if (state.phase === "gameover") state = { ...state, lastTurn: null };
      return draw();
    }
    const result = playMove(move);
    view.cpuHighlight = result.ok ? squaresOf(move, state) : null;
    if (!result.ok) console.error("The computer's move was refused:", move, result.message);
    draw();
  }, CPU_DELAY_MS);
}

setupInput({ board, trays, buttons, view, getState: () => state, onMove: handleMove, onChange: draw });
setupMenu({ menu, onStart: startGame });
setupChallengeUI({ parts: challengeParts, view, onMove: handleMove, onChange: draw });

$("btn-play-again").addEventListener("click", () => startGame(settings));
$("btn-back-to-menu").addEventListener("click", showMenu);

// --- clocks ---

let lastTick = performance.now();

// A tick is a few times a second. It measures how much real time passed and
// hands it to the clock; the clock and the game decide what that means.
function tick() {
  const now = performance.now();
  // A sleeping computer or a frozen tab shouldn't burn through the clock.
  const elapsed = Math.min(now - lastTick, 10000);
  lastTick = now;
  if (!state || state.phase === "gameover") return;

  const events = advanceClock(clock, elapsed, state.currentPlayer);

  if (events.flagFall) {
    state = loseOnTime(state, events.flagFall);
    view.held = null;
    view.hover = null;
    clearSelection(view);
    draw();
    return;
  }
  if (events.capReached) {
    state = callTime(state);
    draw();
  }
  if (events.turnAlert && soundToggle.checked && !cpuToAct(state)) beep();

  renderClocks(clockParts, state, clock);
}
setInterval(tick, 250);

function togglePause() {
  if (!state || state.phase === "gameover") return;
  view.paused = !view.paused;
  setPaused(clock, view.paused);
  draw();
}
$("btn-pause").addEventListener("click", togglePause);
$("btn-resume").addEventListener("click", togglePause);

// --- the turn reminder's beep ---

let audio = null;

// Browsers only allow sound after the person has interacted with the page, so
// the sound system is started when they tick the box.
soundToggle.addEventListener("change", () => {
  if (!soundToggle.checked) return;
  try {
    audio = audio ?? new AudioContext();
    audio.resume();
  } catch (error) {
    audio = null;
  }
});

function beep() {
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  oscillator.frequency.value = 880;
  volume.gain.value = 0.1;
  oscillator.connect(volume);
  volume.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.25);
}

// --- redraw when a canvas changes size ---

const observer = new ResizeObserver(draw);
for (const canvas of [board, trays[1], trays[2]]) observer.observe(canvas);

console.log("Pent 'Em In loaded");
