/**
 * Helpers for the touch-device branch of DateTimePicker, which uses the OS date and time
 * pickers (`<input type="date">` / `<input type="time">`) instead of the popover calendar.
 *
 * Every Date here is a "wall-clock" Date, the same contract as the popover picker: its local
 * year/month/day/hour/minute are what the user picked, and the caller (e.g.
 * DateTimeHelpers.fromPickerDate) applies the real timezone.
 */

const COARSE_POINTER_QUERY = '(pointer: coarse)'
const FINE_POINTER_QUERY = '(any-pointer: fine)'

function getWindow () {
  return typeof window === 'undefined' ? undefined : window
}

/**
 * True for touch-first devices (phones, tablets without a trackpad, the mobile app's WebView):
 * the primary pointer is coarse and no fine pointer (mouse/trackpad) is attached. A touch
 * laptop or an iPad with a trackpad has a fine pointer and keeps the popover picker.
 * Safe without a window (SSR) or matchMedia (older jsdom): returns false.
 */
export function prefersNativeDateTimePicker (win = getWindow()) {
  if (!win || typeof win.matchMedia !== 'function') return false
  return !!win.matchMedia(COARSE_POINTER_QUERY)?.matches && !win.matchMedia(FINE_POINTER_QUERY)?.matches
}

/**
 * Calls `callback` whenever either pointer media query changes (e.g. a mouse or trackpad is
 * connected to a tablet). Returns an unsubscribe function.
 */
export function subscribeToPointerChanges (callback, win = getWindow()) {
  if (!win || typeof win.matchMedia !== 'function') return () => {}
  const queries = [COARSE_POINTER_QUERY, FINE_POINTER_QUERY].map(query => win.matchMedia(query)).filter(Boolean)
  queries.forEach(mql => {
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', callback)
    else if (typeof mql.addListener === 'function') mql.addListener(callback)
  })
  return () => {
    queries.forEach(mql => {
      if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', callback)
      else if (typeof mql.removeListener === 'function') mql.removeListener(callback)
    })
  }
}

const pad = n => String(n).padStart(2, '0')

function isValidDate (date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

/** Wall-clock Date -> `YYYY-MM-DD` for `<input type="date">` ('' when empty). */
export function toDateInputValue (date) {
  if (!isValidDate(date)) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Wall-clock Date -> `HH:mm` (or `HH:mm:ss` with seconds) for `<input type="time">` ('' when empty). */
export function toTimeInputValue (date, { seconds = false } = {}) {
  if (!isValidDate(date)) return ''
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  return seconds ? `${time}:${pad(date.getSeconds())}` : time
}

/** The time a date-only pick lands on when there's no value yet: the current hour, like the popover. */
export function defaultPickerTime (now = new Date()) {
  return new Date(new Date(now).setMinutes(0, 0, 0))
}

/**
 * Applies a `YYYY-MM-DD` date input value to `current`, keeping its time. With no current
 * value the time comes from `fallback`. Returns null for an empty or malformed value, so the
 * caller can keep what it had.
 */
export function applyDateInputValue (current, inputValue, fallback = defaultPickerTime()) {
  const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(inputValue || '')
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const base = isValidDate(current) ? current : fallback
  const next = new Date(base)
  next.setFullYear(year, month - 1, day)
  return isValidDate(next) ? next : null
}

/**
 * Applies an `HH:mm[:ss]` time input value to `current`, keeping its date. With no current
 * value the date is today's. Seconds and milliseconds come from the input (0 when it has
 * none). Returns null for an empty or malformed value.
 */
export function applyTimeInputValue (current, inputValue, now = new Date()) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(inputValue || '')
  if (!match) return null
  const [hours, minutes, seconds = 0] = match.slice(1).map(part => (part === undefined ? 0 : Number(part)))
  if (hours > 23 || minutes > 59 || seconds > 59) return null
  const next = new Date(isValidDate(current) ? current : now)
  next.setHours(hours, minutes, seconds, 0)
  return next
}
