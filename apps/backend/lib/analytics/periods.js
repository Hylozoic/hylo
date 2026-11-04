const DAY_MS = 24 * 60 * 60 * 1000

/** UTC calendar day as YYYY-MM-DD. */
export function utcDay (date) {
  const value = date instanceof Date ? date : new Date(date)
  return value.toISOString().slice(0, 10)
}

/** Parses a YYYY-MM-DD string as a UTC midnight date. */
export function parseDay (day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error('date must be YYYY-MM-DD')
  }
  const date = new Date(`${day}T00:00:00Z`)
  if (date.toISOString().slice(0, 10) !== day) throw new Error('date is not a real day')
  return date
}

/** The next period boundary after a UTC day. */
export function addPeriod (date, period) {
  const next = new Date(date.getTime())
  if (period === 'day') next.setUTCDate(next.getUTCDate() + 1)
  else if (period === 'week') next.setUTCDate(next.getUTCDate() + 7)
  else if (period === 'month') next.setUTCMonth(next.getUTCMonth() + 1)
  else if (period === 'year') next.setUTCFullYear(next.getUTCFullYear() + 1)
  else throw new Error(`unknown period ${period}`)
  return next
}

/** Monday (UTC) of the week containing this date. */
export function startOfWeek (date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = day.getUTCDay()
  day.setUTCDate(day.getUTCDate() - (weekday === 0 ? 6 : weekday - 1))
  return day
}

/**
 * One row per period from `from` through `to`, using a stored value when one
 * exists and null when that period was never computed.
 */
export function fillPoints (points, { from, to, period }) {
  const byDay = new Map((points || []).map(point => [String(point.periodStart).slice(0, 10), point.value]))
  let cursor = parseDay(from)
  const end = parseDay(to)
  if (period === 'week') cursor = startOfWeek(cursor)
  else if (period === 'month') cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1))
  else if (period === 'year') cursor = new Date(Date.UTC(cursor.getUTCFullYear(), 0, 1))
  const filled = []
  let guard = 0
  while (cursor <= end && guard < 2000) {
    const key = utcDay(cursor)
    filled.push({ periodStart: key, value: byDay.has(key) ? byDay.get(key) : null })
    cursor = addPeriod(cursor, period)
    guard++
  }
  return filled
}

/** Day windows of at most `days` length, from `from` up to `to` (exclusive end). */
export function windows (from, to, days = 31) {
  let cursor = parseDay(from)
  const end = parseDay(to)
  const out = []
  while (cursor < end) {
    const next = new Date(cursor.getTime() + days * DAY_MS)
    const capped = next < end ? next : end
    out.push({ from: cursor.toISOString(), to: capped.toISOString() })
    cursor = capped
  }
  return out
}
