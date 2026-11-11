// A small seedable random number generator, so simulated games can be repeated.

// Returns a function that gives numbers from 0 up to (not including) 1.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRandom(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}
