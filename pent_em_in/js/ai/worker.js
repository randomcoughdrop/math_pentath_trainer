// Runs the CPU's thinking off the main thread so the page never freezes.
//
// The page sends { id, state, params, options } and gets back { id, move }, or
// { id, error } if something went wrong. (main.js starts this worker, and
// thinks on the main thread instead if workers aren't available.)

import { nextCpuMove } from "./cpu.js";

self.onmessage = (event) => {
  const { id, state, params, options } = event.data;
  try {
    self.postMessage({ id, move: nextCpuMove(state, params, Math.random, options) });
  } catch (error) {
    self.postMessage({ id, error: String(error && error.message ? error.message : error) });
  }
};
