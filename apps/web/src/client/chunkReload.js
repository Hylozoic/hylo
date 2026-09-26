const RELOAD_FLAG = 'vite-reload-attempted'

/**
 * True when this tab has already reloaded once to recover from a stale chunk.
 * Unreadable storage counts as attempted so a failure can never loop reloads.
 */
export function chunkReloadAttempted () {
  try {
    return !!window.sessionStorage.getItem(RELOAD_FLAG)
  } catch (e) {
    return true
  }
}

export function reloadPage () {
  window.location.reload()
}

/**
 * Reloads once to pick up a new deploy's chunks. Returns false when this tab
 * already tried, so the caller can show an error instead.
 */
export function reloadForStaleChunks () {
  if (chunkReloadAttempted()) return false
  try {
    window.sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch (e) {
    return false
  }
  reloadPage()
  return true
}

/**
 * Clears the flag once the app has actually booted, so a later deploy can
 * reload again. Clearing it earlier (before the lazy app chunk loads) lets a
 * missing chunk reload the page forever.
 */
export function clearChunkReloadFlag () {
  try {
    window.sessionStorage.removeItem(RELOAD_FLAG)
  } catch (e) { /* storage unavailable */ }
}
