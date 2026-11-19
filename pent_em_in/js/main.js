// Entry point: wires everything together.

import { bandForLevel } from "./constants.js";
import { createInitialState } from "./state.js";
import { applyMove, callTime, loseOnTime } from "./game.js";
import { createClock, advanceClock, startTurn, setPaused } from "./clock.js";
import { render, renderTray } from "./renderer.js";
import { setupInput, computePreview, buildOverlay, clearSelection, playableMovesFor, placementOwner } from "./input.js";
import { playerLabel, statusMessage, updateControls, renderLog, renderClocks, gameOverSummary } from "./ui.js";
import { setupMenu, selectChoice } from "./menu.js";
import { setupChallengeUI, renderChallengeUI } from "./challenge-ui.js";
import { cpuToAct, actorNow } from "./players.js";
import { createAnimation, animationFrame, reducedMotion } from "./animation.js";
import { createSound, soundForMove } from "./sound.js";
import { loadSetting, saveSetting, removeSetting } from "./storage.js";
import { replayEvents, buildSave, looksLikeSave, undoCount } from "./save.js";
import { setupHowTo } from "./howto.js";
import { setPatterns } from "./renderer.js";
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
const effectsToggle = $("effects-toggle");
const patternsToggle = $("patterns-toggle");

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
let cpuThinking = false; // the computer is working out a move
let startingPlayer = 1; // who moved first (needed to rebuild the game)
let events = []; // everything that has happened, so the game can be saved and replayed
let cpuToken = 0; // changes when a game starts or ends, so old answers are ignored

// Things that are not part of the game itself: the piece being held, where the
// cursor is, short messages, and whether the game is paused.
const view = {};
function resetView() {
  Object.assign(view, {
    held: null, hover: null, notice: "", announce: "",
    selected: null, action: "slide", pivot: null, turnPreview: null,
    paused: false, challengeOpen: false, cpuHighlight: null, animation: null,
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
  startingPlayer = firstOverride ?? chosen.firstPlayer ?? (Math.random() < 0.5 ? 1 : 2);
  events = [];
  firstOverride = null;

  if (levelOverride !== null) chosen = { ...chosen, level: Math.min(100, Math.max(0, levelOverride)) };
  settings = chosen;
  state = createInitialState({ ...chosen, startingPlayer });
  clock = createClock(chosen.level);
  cpu = cpuParams(chosen.level);
  clearTimeout(cpuTimer);
  cpuTimer = null;
  cpuThinking = false;
  cpuToken++;
  resetView();
  view.announce = "Random draw: " + playerLabel(state, startingPlayer) + " goes first.";

  for (const player of [1, 2]) {
    $("tray-title-" + player).textContent = playerLabel(state, player);
  }
  renderLog(moveLog, state); // new column headings and an empty log

  menu.hidden = true;
  gameScreen.hidden = false;
  lastTick = performance.now();
  saveGame();
  draw();
}

function showMenu() {
  state = null;
  clearTimeout(cpuTimer);
  cpuTimer = null;
  cpuThinking = false;
  cpuToken++;
  gameScreen.hidden = true;
  menu.hidden = false;
  refreshResumeButton();
}

// --- drawing ---

function draw() {
  if (!state) return;

  const preview = computePreview(state, view.held, view.hover);
  const legal = playableMovesFor(state);

  // While paused the board is hidden, so nothing can be studied.
  gameView.hidden = view.paused;
  pauseBanner.hidden = !view.paused;

  // A move in progress: draw the piece partway along, and keep redrawing until it lands.
  let animation = null;
  if (view.animation) {
    const frame = animationFrame(view.animation, performance.now());
    if (frame.done) {
      view.animation = null;
    } else {
      animation = { ...view.animation, progress: frame.progress };
      requestAnimationFrame(draw);
    }
  }

  if (!view.paused) {
    render(board, state, { preview, animation, highlightCells: animation ? null : view.cpuHighlight, ...buildOverlay(state, view, legal) });
    for (const player of [1, 2]) {
      // Only the player whose piece is being placed can hold one.
      renderTray(trays[player], state, player, placementOwner(state) === player ? view.held : null);
    }
  }

  $("btn-undo").hidden = bandForLevel(settings.level) !== "easy"; // Easy only
  $("btn-undo").disabled = state.phase === "gameover" || state.timeCalled || events.length === 0 || view.paused;

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
  const before = state;
  const result = applyMove(state, move);
  if (result.ok) {
    state = result.state;
    events.push(move);
    sound.play(soundForMove(move));
    view.animation = reducedMotion() ? null : createAnimation(before, move, performance.now());
    view.held = null;
    view.hover = null;
    clearSelection(view);
    view.challengeOpen = false;
    startTurn(clock); // the next player's turn timer starts at zero
    saveGame();
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

// The computer thinks in a Web Worker, so a long search never freezes the page.
// If workers aren't available (or the worker fails), it thinks right here instead.
let worker = null;
let workerFailed = false;
let nextJobId = 0;
const jobs = new Map(); // id -> { resolve, state, options } for answers still to come

function startWorker() {
  if (worker || workerFailed) return;
  try {
    worker = new Worker(new URL("./ai/worker.js", import.meta.url), { type: "module" });
  } catch (error) {
    workerFailed = true;
    return;
  }
  worker.onmessage = ({ data }) => {
    const job = jobs.get(data.id);
    if (!job) return;
    jobs.delete(data.id);
    job.resolve(data.error ? nextCpuMove(job.state, cpu, Math.random, job.options) : data.move);
  };
  worker.onerror = () => {
    workerFailed = true;
    worker = null;
    for (const [id, job] of jobs) job.resolve(nextCpuMove(job.state, cpu, Math.random, job.options));
    jobs.clear();
  };
}

// Ask for the computer's move. Returns a promise for the move (or null).
function think(gameState, options) {
  startWorker();
  if (!worker) return Promise.resolve().then(() => nextCpuMove(gameState, cpu, Math.random, options));
  return new Promise((resolve) => {
    const id = ++nextJobId;
    jobs.set(id, { resolve, state: gameState, options });
    // The saved history isn't needed to choose a move, and is slow to copy.
    worker.postMessage({ id, state: { ...gameState, history: [] }, params: cpu, options });
  });
}

// How long the computer may think: what its level allows (see ai/params.js). On
// the chess clock it never uses more than a fortieth of the time it has left,
// so it can't lose on time by thinking.
function thinkingBudget() {
  if (clock.type !== "chess") return cpu.thinkingMs;
  const left = clock.remainingMs[actorNow(state)];
  return Math.min(cpu.thinkingMs, Math.max(100, left / 40));
}

// If it is the computer's turn to act, think and then act. Called after every
// redraw; `cpuThinking` makes sure only one move is being worked on at a time.
function scheduleCpu() {
  if (!state || view.paused || cpuThinking || !cpuToAct(state)) return;
  const waitingOn = state;
  const token = cpuToken;
  const started = performance.now();
  cpuThinking = true;

  think(waitingOn, { budgetMs: thinkingBudget() }).then((move) => {
    // Even a quick answer waits a moment, so its moves can be followed.
    const wait = Math.max(0, CPU_DELAY_MS - (performance.now() - started));
    cpuTimer = setTimeout(() => {
      cpuTimer = null;
      if (token !== cpuToken) return; // a new game started, or the menu came back
      cpuThinking = false;
      applyCpuMove(waitingOn, move);
    }, wait);
  });
}

function applyCpuMove(waitingOn, move) {
  if (state !== waitingOn || view.paused) return draw();
  if (move === null) {
    // Nothing to do (for example, it chooses not to challenge a win). Stop asking.
    if (state.phase === "gameover") state = { ...state, lastTurn: null };
    return draw();
  }
  const result = playMove(move);
  view.cpuHighlight = result.ok ? squaresOf(move, state) : null;
  if (!result.ok) console.error("The computer's move was refused:", move, result.message);
  draw();
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

  const timeEvents = advanceClock(clock, elapsed, state.currentPlayer, !cpuToAct(state));

  if (timeEvents.flagFall) {
    state = loseOnTime(state, timeEvents.flagFall);
    events.push({ type: "@flag", player: timeEvents.flagFall });
    saveGame();
    view.held = null;
    view.hover = null;
    clearSelection(view);
    draw();
    return;
  }
  if (timeEvents.capReached) {
    state = callTime(state);
    events.push({ type: "@time" });
    saveGame();
    draw();
  }
  if (timeEvents.turnAlert && soundToggle.checked && !cpuToAct(state)) beep();

  renderClocks(clockParts, state, clock);
}
setInterval(tick, 250);

// --- saving, resuming, undo ---

function saveGame() {
  if (!state) return;
  if (state.phase === "gameover") removeSetting("game");
  else saveSetting("game", buildSave(settings, startingPlayer, events, clock));
}

function refreshResumeButton() {
  $("btn-resume-saved").hidden = !looksLikeSave(loadSetting("game", null));
}

function resumeGame() {
  const save = loadSetting("game", null);
  const rebuilt = looksLikeSave(save) ? replayEvents(save.settings, save.startingPlayer, save.events) : null;
  if (!rebuilt) {
    removeSetting("game"); // damaged or out of date
    refreshResumeButton();
    return;
  }
  settings = save.settings;
  startingPlayer = save.startingPlayer;
  events = save.events;
  state = rebuilt;
  clock = save.clock;
  cpu = cpuParams(settings.level);
  clearTimeout(cpuTimer);
  cpuTimer = null;
  cpuThinking = false;
  cpuToken++;
  resetView();
  view.announce = "Game resumed. Press Resume to continue.";
  view.paused = true; // so nobody loses time before they're ready
  setPaused(clock, true);
  for (const player of [1, 2]) $("tray-title-" + player).textContent = playerLabel(state, player);
  renderLog(moveLog, state);
  menu.hidden = true;
  gameScreen.hidden = false;
  lastTick = performance.now();
  draw();
}
$("btn-resume-saved").addEventListener("click", resumeGame);
refreshResumeButton();

// Undo is a help for Easy games only. It replays the game without the last move
// (against the computer: without your last move and its reply).
function undo() {
  if (!state || bandForLevel(settings.level) !== "easy" || state.phase === "gameover" || state.timeCalled || view.paused) return;
  const drop = undoCount(settings, startingPlayer, events);
  if (drop === 0) return;
  const rebuilt = replayEvents(settings, startingPlayer, events.slice(0, events.length - drop));
  if (!rebuilt) return;
  events = events.slice(0, events.length - drop);
  state = rebuilt;
  clearTimeout(cpuTimer);
  cpuTimer = null;
  cpuThinking = false;
  cpuToken++; // ignore anything the computer was working on
  const keep = { paused: view.paused };
  resetView();
  Object.assign(view, keep);
  sound.play("undo");
  startTurn(clock);
  saveGame();
  draw();
}
$("btn-undo").addEventListener("click", undo);

setupHowTo({
  dialog: $("howto"), content: $("howto-content"), closeButton: $("howto-close"),
  openButtons: document.querySelectorAll(".open-howto"),
});

function togglePause() {
  if (!state || state.phase === "gameover") return;
  view.paused = !view.paused;
  setPaused(clock, view.paused);
  draw();
}
$("btn-pause").addEventListener("click", togglePause);
$("btn-resume").addEventListener("click", togglePause);

// --- the turn reminder's beep ---

const sound = createSound();
const beep = () => sound.play("alert");

// Browsers only allow sound after the person has touched the page.
for (const kind of ["pointerdown", "keydown"]) document.addEventListener(kind, () => sound.unlock(), { once: true });

effectsToggle.checked = loadSetting("effects", true);
sound.setEnabled(effectsToggle.checked);
effectsToggle.addEventListener("change", () => {
  sound.setEnabled(effectsToggle.checked);
  saveSetting("effects", effectsToggle.checked);
});

// Piece patterns: player 2's pieces are hatched, so the players never depend on color alone.
patternsToggle.checked = loadSetting("patterns", false);
setPatterns(patternsToggle.checked);
patternsToggle.addEventListener("change", () => {
  setPatterns(patternsToggle.checked);
  saveSetting("patterns", patternsToggle.checked);
  draw();
});

// --- redraw when a canvas changes size ---

const observer = new ResizeObserver(draw);
for (const canvas of [board, trays[1], trays[2]]) observer.observe(canvas);

console.log("Pent 'Em In loaded");
