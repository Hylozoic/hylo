import { DateTime } from 'luxon'

/*
 * Timezone-safe expansion of iCalendar RRULE strings (RFC 5545 subset).
 *
 * We intentionally support only the recurrence vocabulary that the Hylo UI can
 * produce, and we expand occurrences with luxon arithmetic in the event's own
 * timezone. This keeps wall-clock times stable across DST transitions (a
 * weekly 6pm event stays at 6pm), which UTC-based expansion gets wrong.
 *
 * Supported: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL, COUNT, UNTIL,
 * BYDAY (weekly: plain weekdays; monthly: ordinal weekdays like 2TU or -1FR),
 * BYMONTHDAY. Anything else throws, so unsupported rules fail loudly rather
 * than silently generating the wrong dates.
 */

/** The maximum number of not-yet-past occurrences a series may have at once. */
export const MAX_FUTURE_OCCURRENCES = 20

/** Safety valve for rules that never produce a matching candidate. */
const HARD_ITERATION_CAP = 5000

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type RecurrenceFrequency = typeof FREQUENCIES[number]

// ISO weekday numbers as used by luxon: Monday = 1 .. Sunday = 7
const WEEKDAY_CODES: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 }
const WEEKDAY_NAMES: Record<number, string> = { 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA', 7: 'SU' }

export interface RecurrenceByDay {
  /** e.g. 2 for "second X of the month", -1 for "last X". Only valid with MONTHLY. */
  ordinal?: number
  /** ISO weekday, Monday = 1 .. Sunday = 7 */
  weekday: number
}

export interface RecurrenceRuleOptions {
  freq: RecurrenceFrequency
  interval: number
  byDay?: RecurrenceByDay[]
  byMonthDay?: number[]
  /** Total number of occurrences, including the first one. */
  count?: number
  /** Raw RFC 5545 UNTIL value: YYYYMMDD or YYYYMMDDTHHMMSSZ (inclusive). */
  until?: string
}

export interface ExpandRecurrenceRuleOptions {
  rule: string
  /** The first occurrence of the series (always included in the pattern). */
  dtstart: string | Date
  /** IANA timezone the rule is anchored in. Defaults to UTC. */
  timezone?: string
  /** Only return occurrences strictly after this instant. */
  after?: string | Date
  /** Maximum occurrences to return; capped at MAX_FUTURE_OCCURRENCES. */
  limit?: number
}

/** Parses an RRULE string into structured options, throwing on anything unsupported. */
export function parseRecurrenceRule (rule: string): RecurrenceRuleOptions {
  if (!rule || typeof rule !== 'string') throw new Error('Recurrence rule must be a non-empty string')

  const body = rule.trim().replace(/^RRULE:/i, '')
  const options: RecurrenceRuleOptions = { freq: 'WEEKLY', interval: 1 }
  let sawFreq = false

  for (const part of body.split(';')) {
    if (!part) continue
    const [key, value] = part.split('=')
    if (!value) throw new Error(`Malformed recurrence rule part: ${part}`)

    switch (key.toUpperCase()) {
      case 'FREQ': {
        const freq = value.toUpperCase() as RecurrenceFrequency
        if (!FREQUENCIES.includes(freq)) throw new Error(`Unsupported FREQ: ${value}`)
        options.freq = freq
        sawFreq = true
        break
      }
      case 'INTERVAL': {
        const interval = Number(value)
        if (!Number.isInteger(interval) || interval < 1) throw new Error(`Invalid INTERVAL: ${value}`)
        options.interval = interval
        break
      }
      case 'COUNT': {
        const count = Number(value)
        if (!Number.isInteger(count) || count < 1) throw new Error(`Invalid COUNT: ${value}`)
        options.count = count
        break
      }
      case 'UNTIL': {
        if (!/^\d{8}(T\d{6}Z)?$/.test(value)) throw new Error(`Invalid UNTIL: ${value}`)
        options.until = value
        break
      }
      case 'BYDAY': {
        options.byDay = value.toUpperCase().split(',').map(token => {
          const match = token.match(/^(-?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/)
          if (!match) throw new Error(`Invalid BYDAY entry: ${token}`)
          const byDay: RecurrenceByDay = { weekday: WEEKDAY_CODES[match[2]] }
          if (match[1]) {
            const ordinal = Number(match[1])
            if (ordinal === 0 || ordinal > 5 || ordinal < -5) throw new Error(`Invalid BYDAY ordinal: ${token}`)
            byDay.ordinal = ordinal
          }
          return byDay
        })
        break
      }
      case 'BYMONTHDAY': {
        options.byMonthDay = value.split(',').map(entry => {
          const day = Number(entry)
          if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error(`Invalid BYMONTHDAY entry: ${entry}`)
          return day
        })
        break
      }
      case 'WKST':
        // We always use the RFC default (Monday); accept and ignore.
        break
      default:
        throw new Error(`Unsupported recurrence rule part: ${key}`)
    }
  }

  if (!sawFreq) throw new Error('Recurrence rule must include FREQ')
  if (options.byDay?.some(d => d.ordinal !== undefined) && options.freq !== 'MONTHLY') {
    throw new Error('BYDAY ordinals are only supported with FREQ=MONTHLY')
  }
  if (options.freq === 'MONTHLY' && options.byDay?.some(d => d.ordinal === undefined)) {
    throw new Error('FREQ=MONTHLY requires ordinals on every BYDAY entry (e.g. 2TU)')
  }
  if (options.byDay && options.byMonthDay) {
    throw new Error('BYDAY and BYMONTHDAY cannot be combined')
  }
  if (options.count && options.until) {
    throw new Error('COUNT and UNTIL cannot be combined')
  }

  return options
}

/** Serializes structured recurrence options back into a normalized RRULE string. */
export function buildRecurrenceRule (options: RecurrenceRuleOptions): string {
  const parts = [`FREQ=${options.freq}`]
  if (options.interval && options.interval !== 1) parts.push(`INTERVAL=${options.interval}`)
  if (options.byDay?.length) {
    parts.push(`BYDAY=${options.byDay.map(d => `${d.ordinal ?? ''}${WEEKDAY_NAMES[d.weekday]}`).join(',')}`)
  }
  if (options.byMonthDay?.length) parts.push(`BYMONTHDAY=${options.byMonthDay.join(',')}`)
  if (options.count) parts.push(`COUNT=${options.count}`)
  if (options.until) parts.push(`UNTIL=${options.until}`)
  return parts.join(';')
}

/** Returns true when the rule parses to a supported recurrence. */
export function validateRecurrenceRule (rule: string): boolean {
  try {
    parseRecurrenceRule(rule)
    return true
  } catch (e) {
    return false
  }
}

/** Parses and re-serializes a rule, producing a canonical form for storage. */
export function normalizeRecurrenceRule (rule: string): string {
  return buildRecurrenceRule(parseRecurrenceRule(rule))
}

/**
 * Expands a rule into concrete occurrence start instants (as JS Dates).
 * dtstart is always the pattern's first occurrence. COUNT is consumed from
 * dtstart even when `after` skips early occurrences, so re-expanding a
 * partially-materialized series stays consistent.
 */
export function expandRecurrenceRule ({ rule, dtstart, timezone, after, limit }: ExpandRecurrenceRuleOptions): Date[] {
  const zone = timezone || 'UTC'
  const options = parseRecurrenceRule(rule)
  const start = toZonedDateTime(dtstart, zone)
  if (!start.isValid) throw new Error('Invalid dtstart for recurrence expansion')

  const untilDt = options.until ? resolveUntil(options.until, zone) : null
  const afterDt = after ? toZonedDateTime(after, zone) : null
  const cap = Math.min(limit ?? MAX_FUTURE_OCCURRENCES, MAX_FUTURE_OCCURRENCES)
  if (cap <= 0) return []

  const results: Date[] = []
  let produced = 0

  for (const candidate of candidateDateTimes(start, options)) {
    if (untilDt && candidate > untilDt) break
    if (options.count && produced >= options.count) break
    produced++
    if (!afterDt || candidate > afterDt) results.push(candidate.toJSDate())
    if (results.length >= cap) break
  }

  return results
}

function toZonedDateTime (value: string | Date, zone: string): DateTime {
  const dt = value instanceof Date ? DateTime.fromJSDate(value) : DateTime.fromISO(value)
  return dt.setZone(zone)
}

/** UNTIL is either a UTC instant or a date, which we read as end-of-day in the event zone. */
function resolveUntil (until: string, zone: string): DateTime {
  if (until.length === 8) {
    return DateTime.fromFormat(until, 'yyyyMMdd', { zone }).endOf('day')
  }
  return DateTime.fromFormat(until, "yyyyMMdd'T'HHmmss'Z'", { zone: 'utc' }).setZone(zone)
}

/** Yields pattern occurrences in ascending order, starting with dtstart itself. */
function * candidateDateTimes (start: DateTime, options: RecurrenceRuleOptions): Generator<DateTime> {
  yield start

  const timeOfDay = { hour: start.hour, minute: start.minute, second: start.second, millisecond: start.millisecond }
  let iterations = 0

  switch (options.freq) {
    case 'DAILY': {
      let cursor = start
      while (iterations++ < HARD_ITERATION_CAP) {
        cursor = cursor.plus({ days: options.interval })
        if (options.byDay && !options.byDay.some(d => d.weekday === cursor.weekday)) continue
        yield cursor
      }
      return
    }

    case 'WEEKLY': {
      const weekdays = (options.byDay?.map(d => d.weekday) || [start.weekday]).sort((a, b) => a - b)
      for (let week = 0; iterations++ < HARD_ITERATION_CAP; week++) {
        const weekStart = start.startOf('week').plus({ weeks: options.interval * week })
        for (const weekday of weekdays) {
          const candidate = weekStart.plus({ days: weekday - 1 }).set(timeOfDay)
          if (candidate > start) yield candidate
        }
      }
      return
    }

    case 'MONTHLY': {
      for (let month = 0; iterations++ < HARD_ITERATION_CAP; month++) {
        const monthStart = start.startOf('month').plus({ months: options.interval * month })
        const daysInMonth = monthStart.daysInMonth ?? 0
        const candidates: DateTime[] = []

        if (options.byDay?.length) {
          for (const { ordinal, weekday } of options.byDay) {
            const candidate = nthWeekdayOfMonth(monthStart, weekday, ordinal as number)
            if (candidate) candidates.push(candidate.set(timeOfDay))
          }
        } else if (options.byMonthDay?.length) {
          for (const day of options.byMonthDay) {
            if (day <= daysInMonth) candidates.push(monthStart.set({ day, ...timeOfDay }))
          }
        } else if (start.day <= daysInMonth) {
          // Months without the anchor day (e.g. the 31st) are skipped, per RFC 5545
          candidates.push(monthStart.set({ day: start.day, ...timeOfDay }))
        }

        for (const candidate of candidates.sort((a, b) => a.toMillis() - b.toMillis())) {
          if (candidate > start) yield candidate
        }
      }
      return
    }

    case 'YEARLY': {
      for (let year = 1; iterations++ < HARD_ITERATION_CAP; year++) {
        const monthStart = start.startOf('month').plus({ years: options.interval * year })
        // Skips Feb 29 anchors in non-leap years, per RFC 5545
        if (start.day <= (monthStart.daysInMonth ?? 0)) {
          yield monthStart.set({ day: start.day, ...timeOfDay })
        }
      }
    }
  }
}

/** The nth (or nth-from-last, when negative) given weekday within the month, or null when absent. */
function nthWeekdayOfMonth (monthStart: DateTime, weekday: number, ordinal: number): DateTime | null {
  if (ordinal > 0) {
    const firstOffset = (weekday - monthStart.weekday + 7) % 7
    const candidate = monthStart.plus({ days: firstOffset + (ordinal - 1) * 7 })
    return candidate.month === monthStart.month ? candidate : null
  }
  const monthEnd = monthStart.endOf('month').startOf('day')
  const lastOffset = (monthEnd.weekday - weekday + 7) % 7
  const candidate = monthEnd.minus({ days: lastOffset + (-ordinal - 1) * 7 })
  return candidate.month === monthStart.month ? candidate : null
}
