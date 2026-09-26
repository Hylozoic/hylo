const RELOAD_FLAG = 'vite-reload-attempted'
// Stored as the flag's value, so a reload this page started (and is waiting
// for) can be told apart from one a previous page load already tried
const PAGE_LOAD_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`

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

/**
 * True when this page has started the reload and it is still in flight.
 * Vite's vite:preloadError starts it before the failed import reaches an error
 * boundary, which should then wait for it rather than show an error.
 */
export function chunkReloadPending () {
  try {
    return window.sessionStorage.getItem(RELOAD_FLAG) === PAGE_LOAD_ID
  } catch (e) {
    return false
  }
}

export function reloadPage () {
  window.location.reload()
}

/**
 * Reloads once to pick up a new deploy's chunks. Returns true while that
 * reload is underway, and false when an earlier page load already tried, so
 * the caller can show an error instead.
 */
export function reloadForStaleChunks () {
  if (chunkReloadPending()) return true
  if (chunkReloadAttempted()) return false
  try {
    window.sessionStorage.setItem(RELOAD_FLAG, PAGE_LOAD_ID)
  } catch (e) {
    return false
  }
  reloadPage()
  return true
}

/**
 * Reloads once when Vite fails to fetch a dynamic import (stale chunks after a
 * deploy). Returns a function that stops listening.
 */
export function listenForStaleChunks () {
  const onPreloadError = () => { reloadForStaleChunks() }
  window.addEventListener('vite:preloadError', onPreloadError)
  return () => window.removeEventListener('vite:preloadError', onPreloadError)
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
