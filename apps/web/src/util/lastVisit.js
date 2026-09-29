import { useEffect, useState } from 'react'

/**
 * "Last visit" for the What's new landing: the All My Groups feed marks the
 * posts newer than the person's previous visit. Unread dots are left as they
 * are, so visits are tracked on their own, per device:
 *
 * - localStorage keeps when Hylo was last in use (refreshed while it's open).
 * - A visit starts with a new tab session, or after VISIT_GAP_MS without use.
 *   The last-in-use time from before it becomes the visit's baseline, kept in
 *   sessionStorage so a reload keeps the same divider.
 *
 * Storage can be unavailable (private windows, blocked site data); then there
 * is simply no baseline and no divider.
 */
export const VISIT_GAP_MS = 30 * 60 * 1000
const ACTIVE_REFRESH_MS = 60 * 1000
const VISIT_START_EVENT = 'hylo:visit-start'

const lastSeenKey = userId => `hylo-last-seen:${userId}`
const baselineKey = userId => `hylo-visit-baseline:${userId}`

function read (storageName, key) {
  try { return window[storageName].getItem(key) } catch (e) { return null }
}

function write (storageName, key, value) {
  try { window[storageName].setItem(key, value) } catch (e) {}
}

function readLastSeen (userId) {
  return Number(read('localStorage', lastSeenKey(userId))) || null
}

function saveBaseline (userId, lastSeen) {
  write('sessionStorage', baselineKey(userId), lastSeen ? String(lastSeen) : '')
}

// Only called from effects and timers: listeners update component state
function startVisit (userId, lastSeen) {
  saveBaseline(userId, lastSeen)
  try { window.dispatchEvent(new CustomEvent(VISIT_START_EVENT, { detail: { userId } })) } catch (e) {}
}

/**
 * Records that Hylo is in use now. Starts a new visit first when this tab
 * hasn't started one yet, or when Hylo went unused for longer than the gap.
 */
export function markVisitActive (userId, now = Date.now()) {
  if (!userId) return
  const lastSeen = readLastSeen(userId)
  const hasBaseline = read('sessionStorage', baselineKey(userId)) !== null
  if (!hasBaseline || (lastSeen && now - lastSeen > VISIT_GAP_MS)) {
    startVisit(userId, lastSeen)
  }
  write('localStorage', lastSeenKey(userId), String(now))
}

/**
 * When the person was last here before this visit, or null (first visit on
 * this device, or no storage). Starts the visit if nothing has yet.
 */
export function getVisitBaseline (userId) {
  if (!userId) return null
  let value = read('sessionStorage', baselineKey(userId))
  if (value === null) {
    // Safe during render: no event, just the first read of this visit
    saveBaseline(userId, readLastSeen(userId))
    value = read('sessionStorage', baselineKey(userId))
  }
  const time = Number(value)
  return time ? new Date(time) : null
}

/**
 * Keeps the last-in-use time current while Hylo is open and visible. Mounted
 * by the navigation (side rail or top bar), which is on screen all session.
 */
export function useVisitTracker (userId) {
  useEffect(() => {
    if (!userId) return
    const markIfVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') markVisitActive(userId)
    }
    // Leaving the tab also counts as the last moment in use
    const handleVisibility = () => markVisitActive(userId)
    markIfVisible()
    const interval = setInterval(markIfVisible, ACTIVE_REFRESH_MS)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [userId])
}

/** This visit's baseline, updated when a new visit starts. */
export function useVisitBaseline (userId) {
  const [baseline, setBaseline] = useState(() => getVisitBaseline(userId))
  useEffect(() => {
    setBaseline(getVisitBaseline(userId))
    if (!userId) return
    const handleVisitStart = event => {
      if (String(event.detail?.userId) === String(userId)) setBaseline(getVisitBaseline(userId))
    }
    window.addEventListener(VISIT_START_EVENT, handleVisitStart)
    return () => window.removeEventListener(VISIT_START_EVENT, handleVisitStart)
  }, [userId])
  return baseline
}
