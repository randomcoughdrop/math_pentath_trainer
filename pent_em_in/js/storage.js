// Tiny wrappers around localStorage. Private windows and blocked storage make
// it throw, so every call is wrapped and the game works without it.

export function loadSetting(key, fallback) {
  try {
    const raw = localStorage.getItem("pentEmIn." + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

export function saveSetting(key, value) {
  try {
    localStorage.setItem("pentEmIn." + key, JSON.stringify(value));
  } catch (error) {
    // Nothing to do: the setting just won't be remembered.
  }
}

export function removeSetting(key) {
  try {
    localStorage.removeItem("pentEmIn." + key);
  } catch (error) {
    // Ignore.
  }
}
