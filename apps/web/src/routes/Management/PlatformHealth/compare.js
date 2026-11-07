import { isMonthlyLabels, isNumber, isStrictIsoDate, isWindowEnd } from './format'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY = /^\d{4}-\d{2}-\d{2}/
const QUARTER = /\b(\d{4})-Q([1-4])\b/g
// Monthly window-end series end with a point on the as-of date itself, which lands a day or two
// away from the same point in the earlier panel
const WINDOW_END_TOLERANCE_DAYS = 3
// Whole weeks (52 and 26), so weekly buckets, which start on Mondays, line up with Mondays a period earlier
export const COMPARE_PERIODS = {
  '1y': { days: 364, months: 12 },
  '6m': { days: 182, months: 6 }
}

export const DEFAULT_COMPARE_PERIOD = '1y'

function parseDay (value) {
  if (typeof value !== 'string' || !DAY.test(value)) return null
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function isoDay (date) {
  return date.toISOString().slice(0, 10)
}

function daysBefore (date, days) {
  return new Date(date.getTime() - days * DAY_MS)
}

function monthsBefore (date, months) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)))
}

/**
 * Identifies a series line across two panels: its key, or its label when it has none.
 */
export function lineKey (line) {
  return line?.key ?? line?.label
}

/**
 * The date ('YYYY-MM-DD') to load for comparison with `baseDate`, or null for an unknown date or period.
 */
export function comparisonAsOf (baseDate, period) {
  const date = parseDay(baseDate)
  const spec = COMPARE_PERIODS[period]
  if (!date || !spec) return null
  return isoDay(daysBefore(date, spec.days))
}

/**
 * The x label one period before `label`. Monthly series move by calendar months (the day clamped to the
 * target month's length); everything else by whole weeks.
 */
export function shiftLabel (label, data, period) {
  const date = parseDay(label)
  const spec = COMPARE_PERIODS[period]
  if (!date || !spec) return null
  if (data?.granularity === 'month') return isoDay(monthsBefore(date, spec.months))
  return isoDay(daysBefore(date, spec.days))
}

function dayDistance (a, b) {
  const da = parseDay(a)
  const db = parseDay(b)
  if (!da || !db) return null
  return Math.abs(da.getTime() - db.getTime()) / DAY_MS
}

/**
 * Lines up an earlier panel's series with the current one. Returns { x, values }: x holds, for each
 * current x, the matched earlier x (or null); values maps each line key to the earlier values aligned to
 * the current x. A value is null when nothing matched or when either side's bucket is still in progress.
 * Each earlier point is matched at most once.
 */
export function alignSeries (mainData, compData, period) {
  const mainX = mainData?.x || []
  const compX = compData?.x || []
  const matched = mainX.map(() => -1)
  const used = new Set()
  const targets = mainX.map(label => shiftLabel(label, mainData, period))

  const indexByDay = new Map()
  compX.forEach((label, idx) => {
    const day = parseDay(label) ? label.slice(0, 10) : null
    if (day && !indexByDay.has(day)) indexByDay.set(day, idx)
  })
  targets.forEach((target, i) => {
    const idx = target ? indexByDay.get(target) : undefined
    if (idx === undefined || used.has(idx)) return
    matched[i] = idx
    used.add(idx)
  })

  if (isWindowEnd(mainData)) {
    targets.forEach((target, i) => {
      if (matched[i] >= 0 || !target) return
      let best = -1
      let bestDistance = Infinity
      compX.forEach((label, idx) => {
        if (used.has(idx)) return
        const distance = dayDistance(label, target)
        if (distance !== null && distance <= WINDOW_END_TOLERANCE_DAYS && distance < bestDistance) {
          best = idx
          bestDistance = distance
        }
      })
      if (best < 0) return
      matched[i] = best
      used.add(best)
    })
  }

  const mainPartial = mainData?.partialLast ? mainX.length - 1 : -1
  const compPartial = compData?.partialLast ? compX.length - 1 : -1
  const usable = matched.map((idx, i) => (idx < 0 || i === mainPartial || idx === compPartial ? -1 : idx))
  const compLines = new Map((compData?.lines || []).map(line => [lineKey(line), line]))
  const values = {}
  for (const line of mainData?.lines || []) {
    const compLine = compLines.get(lineKey(line))
    if (!compLine) continue
    values[lineKey(line)] = usable.map(idx => (idx >= 0 && isNumber(compLine.values?.[idx]) ? compLine.values[idx] : null))
  }
  return { x: matched.map(idx => (idx >= 0 ? compX[idx] : null)), values }
}

/**
 * A breakdown label with its quarters ('2025-Q3') moved back one period, so a row about a quarter
 * matches the row about the quarter a period earlier.
 */
export function shiftPeriodTokens (label, period) {
  const spec = COMPARE_PERIODS[period]
  if (typeof label !== 'string' || !spec) return label
  return label.replace(QUARTER, (match, year, quarter) => {
    const index = Number(year) * 4 + Number(quarter) - 1 - spec.months / 3
    return `${Math.floor(index / 4)}-Q${(index % 4) + 1}`
  })
}

function sameDay (a, b) {
  return isStrictIsoDate(a) && isStrictIsoDate(b) && a.slice(0, 10) === b.slice(0, 10)
}

function primaryFirst (lines = []) {
  const primary = lines.find(line => line.primary) || lines[0]
  return primary ? [primary, ...lines.filter(line => line !== primary)] : []
}

/**
 * The earlier panel's headline for the period matching `headline`'s, as { value, period }, or null.
 * `earlierHeadline` is the earlier metric's own headline. A headline without a date (none, or a phrase
 * such as 'last 30 days') is taken as it is. A dated one is taken only when its date is the matching
 * period; otherwise the value comes from the earlier panel's cell that matches the one holding the
 * current value (a series point, or a cohort row and column), because the two panels' latest complete
 * periods can be one apart. Null when there is no such cell.
 */
export function pairedHeadline (metric, headline, earlierMetric, earlierHeadline, period) {
  if (!earlierMetric || !headline) return null
  const own = earlierHeadline && isNumber(earlierHeadline.value) ? earlierHeadline : null
  if (!isStrictIsoDate(headline.period)) return own
  const day = headline.period.slice(0, 10)
  const data = metric?.data
  const earlierData = earlierMetric.data

  if (metric?.display === 'series') {
    const idx = (data?.x || []).findIndex(x => typeof x === 'string' && x.slice(0, 10) === day)
    if (idx < 0) return own && sameDay(own.period, shiftLabel(day, data, period)) ? own : null
    const aligned = alignSeries(data, earlierData, period)
    const target = aligned.x[idx]
    if (!target) return null
    if (own && sameDay(own.period, target)) return own
    const line = primaryFirst(data.lines).find(l => l.values?.[idx] === headline.value)
    const value = line ? aligned.values[lineKey(line)]?.[idx] : null
    return isNumber(value) ? { value, period: target } : null
  }

  if (metric?.display === 'cohort') {
    const rows = data?.rows || []
    const granularity = isMonthlyLabels(rows.map(row => row.label)) ? 'month' : null
    const target = shiftLabel(day, { granularity }, period)
    if (own && sameDay(own.period, target)) return own
    const earlierRows = new Map((earlierData?.rows || []).map(row => [row.label, row]))
    for (const row of rows) {
      if (typeof row.label !== 'string' || row.label.slice(0, 10) !== day) continue
      const col = (row.values || []).findIndex(v => v === headline.value)
      if (col < 0) continue
      const value = earlierRows.get(`${target}${row.label.slice(10)}`)?.values?.[col]
      return isNumber(value) ? { value, period: target } : null
    }
    return null
  }

  return own && sameDay(own.period, shiftLabel(day, {}, period)) ? own : null
}

/**
 * Metrics of a comparison panel by id.
 */
export function comparisonMetricMap (compData) {
  const metrics = new Map()
  for (const section of compData?.sections || []) {
    for (const metric of section.metrics || []) metrics.set(metric.id, metric)
  }
  return metrics
}

/**
 * The comparison panel's version of `metric`, or null when it is missing or failed there, or when the
 * server marks the metric `comparable: false` (its value can't be rebuilt for a past date).
 */
export function comparisonMetric (metrics, metric) {
  if (!metric || metric.comparable === false) return null
  const earlier = metrics?.get(metric.id)
  return earlier && !earlier.error && earlier.comparable !== false ? earlier : null
}
