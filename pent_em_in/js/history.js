// Saves earlier game states, so a move can be taken back (challenges in Phase 6).
//
// Before every move, a copy of the state is added to the new state's `history`
// list. A saved copy has no history of its own (otherwise each copy would hold
// every earlier copy). Entry 0 is the state before the first move.

// A full independent copy of the state, without its history.
export function snapshotOf(state) {
  const { history, ...rest } = state;
  return structuredClone(rest);
}

// Add a snapshot of `before` to the history of `next`. `next` is a copy that
// is still being built.
export function recordSnapshot(next, before) {
  next.history.push(snapshotOf(before));
}

// The state as it was before move number `index` (0 is the very first move),
// with its history cut back to match. Returns a new state; nothing is changed.
export function restoreSnapshot(state, index) {
  if (index < 0 || index >= state.history.length) return null;
  const restored = structuredClone(state.history[index]);
  restored.history = state.history.slice(0, index); // snapshots are never changed, so they can be shared
  return restored;
}
