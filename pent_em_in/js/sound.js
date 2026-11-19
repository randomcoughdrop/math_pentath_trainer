// Small synthesized sound effects (no audio files). Browsers only allow sound
// after the person has touched the page, so the audio system starts on the
// first tap or key press.

const EFFECTS = {
  place: [[392, 0.09], [523, 0.12]],
  move: [[440, 0.08]],
  chip: [[660, 0.06], [740, 0.06]],
  challenge: [[330, 0.12], [247, 0.18]],
  win: [[523, 0.12], [659, 0.12], [784, 0.25]],
  alert: [[880, 0.25]],
  undo: [[392, 0.08], [330, 0.08]],
};

export function createSound() {
  let context = null;
  let enabled = true;

  function unlock() {
    try {
      context = context ?? new AudioContext();
      context.resume();
    } catch (error) {
      context = null;
    }
  }

  function play(name) {
    if (!enabled || !context || !EFFECTS[name]) return;
    let start = context.currentTime;
    for (const [frequency, length] of EFFECTS[name]) {
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0.12, start);
      volume.gain.exponentialRampToValueAtTime(0.001, start + length);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + length);
      start += length * 0.9;
    }
  }

  return { unlock, play, setEnabled(value) { enabled = value; }, get enabled() { return enabled; } };
}

// Which sound goes with a move.
export function soundForMove(move) {
  if (move.type === "place") return "place";
  if (move.type === "chip" || move.type === "relocate-chip") return "chip";
  if (move.type === "challenge" || move.type === "challenge-win") return "challenge";
  return "move";
}
