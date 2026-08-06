import { DateTime } from 'luxon'
import {
  MAX_FUTURE_OCCURRENCES,
  buildRecurrenceRule,
  expandRecurrenceRule,
  normalizeRecurrenceRule,
  parseRecurrenceRule,
  validateRecurrenceRule
} from './RecurrenceHelpers'

// Tuesday, Jan 6 2026, 6pm in Los Angeles
const LA = 'America/Los_Angeles'
const dtstart = DateTime.fromObject(
  { year: 2026, month: 1, day: 6, hour: 18 },
  { zone: LA }
).toJSDate()

const inZone = (date: Date, zone = LA) => DateTime.fromJSDate(date).setZone(zone)

describe('parseRecurrenceRule', () => {
  it('parses a weekly rule with days and count', () => {
    expect(parseRecurrenceRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=10')).toEqual({
      freq: 'WEEKLY',
      interval: 2,
      byDay: [{ weekday: 2 }, { weekday: 4 }],
      count: 10
    })
  })

  it('parses monthly ordinal BYDAY and strips the RRULE: prefix', () => {
    expect(parseRecurrenceRule('RRULE:FREQ=MONTHLY;BYDAY=2TU')).toEqual({
      freq: 'MONTHLY',
      interval: 1,
      byDay: [{ ordinal: 2, weekday: 2 }]
    })
  })

  it('rejects unsupported or malformed rules', () => {
    expect(() => parseRecurrenceRule('FREQ=HOURLY')).toThrow()
    expect(() => parseRecurrenceRule('INTERVAL=2')).toThrow(/FREQ/)
    expect(() => parseRecurrenceRule('FREQ=WEEKLY;BYSETPOS=1')).toThrow(/Unsupported/)
    expect(() => parseRecurrenceRule('FREQ=WEEKLY;BYDAY=2TU')).toThrow(/MONTHLY/)
    expect(() => parseRecurrenceRule('FREQ=MONTHLY;BYDAY=TU')).toThrow(/ordinal/)
    expect(() => parseRecurrenceRule('FREQ=WEEKLY;COUNT=5;UNTIL=20260601')).toThrow()
    expect(() => parseRecurrenceRule('FREQ=WEEKLY;COUNT=0')).toThrow()
  })
})

describe('validateRecurrenceRule / normalizeRecurrenceRule / buildRecurrenceRule', () => {
  it('validates without throwing', () => {
    expect(validateRecurrenceRule('FREQ=WEEKLY;BYDAY=MO')).toBe(true)
    expect(validateRecurrenceRule('nonsense')).toBe(false)
    expect(validateRecurrenceRule('')).toBe(false)
  })

  it('normalizes to a canonical string', () => {
    expect(normalizeRecurrenceRule('rrule:freq=weekly;interval=1;byday=tu,th;wkst=MO'))
      .toBe('FREQ=WEEKLY;BYDAY=TU,TH')
  })

  it('round-trips through build and parse', () => {
    const rule = 'FREQ=MONTHLY;INTERVAL=3;BYDAY=-1FR;COUNT=8'
    expect(buildRecurrenceRule(parseRecurrenceRule(rule))).toBe(rule)
  })
})

describe('expandRecurrenceRule', () => {
  it('always includes dtstart as the first occurrence', () => {
    const dates = expandRecurrenceRule({ rule: 'FREQ=WEEKLY;COUNT=3', dtstart, timezone: LA })
    expect(dates[0].getTime()).toBe(dtstart.getTime())
    expect(dates).toHaveLength(3)
  })

  it('expands weekly rules on the dtstart weekday by default', () => {
    const dates = expandRecurrenceRule({ rule: 'FREQ=WEEKLY;COUNT=4', dtstart, timezone: LA })
    expect(dates.map(d => inZone(d).toISODate())).toEqual([
      '2026-01-06', '2026-01-13', '2026-01-20', '2026-01-27'
    ])
  })

  it('expands weekly BYDAY rules, including later days of the starting week', () => {
    const dates = expandRecurrenceRule({ rule: 'FREQ=WEEKLY;BYDAY=TU,TH;COUNT=4', dtstart, timezone: LA })
    expect(dates.map(d => inZone(d).toISODate())).toEqual([
      '2026-01-06', '2026-01-08', '2026-01-13', '2026-01-15'
    ])
  })

  it('respects INTERVAL', () => {
    const dates = expandRecurrenceRule({ rule: 'FREQ=WEEKLY;INTERVAL=2;COUNT=3', dtstart, timezone: LA })
    expect(dates.map(d => inZone(d).toISODate())).toEqual([
      '2026-01-06', '2026-01-20', '2026-02-03'
    ])
  })

  it('keeps wall-clock time across the spring DST transition', () => {
    // US DST begins March 8 2026; a weekly 6pm event must stay at 6pm local
    const dates = expandRecurrenceRule({ rule: 'FREQ=WEEKLY;COUNT=12', dtstart, timezone: LA })
    for (const date of dates) {
      expect(inZone(date).hour).toBe(18)
    }
    const offsets = new Set(dates.map(d => inZone(d).offset))
    expect(offsets.size).toBe(2) // spans PST and PDT
  })

  it('keeps wall-clock time across the fall DST transition', () => {
    const octStart = DateTime.fromObject({ year: 2026, month: 10, day: 20, hour: 9 }, { zone: LA }).toJSDate()
    // US DST ends November 1 2026
    const dates = expandRecurrenceRule({ rule: 'FREQ=WEEKLY;COUNT=4', dtstart: octStart, timezone: LA })
    for (const date of dates) {
      expect(inZone(date).hour).toBe(9)
    }
  })

  it('expands daily rules filtered to weekdays', () => {
    const dates = expandRecurrenceRule({ rule: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=5', dtstart, timezone: LA })
    expect(dates.map(d => inZone(d).toISODate())).toEqual([
      '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-12'
    ])
  })

  it('expands monthly ordinal weekday rules (first Tuesday)', () => {
    const dates = expandRecurrenceRule({ rule: 'FREQ=MONTHLY;BYDAY=1TU;COUNT=4', dtstart, timezone: LA })
    expect(dates.map(d => inZone(d).toISODate())).toEqual([
      '2026-01-06', '2026-02-03', '2026-03-03', '2026-04-07'
    ])
  })

  it('expands monthly last-weekday rules (last Friday)', () => {
    const dates = expandRecurrenceRule({ rule: 'FREQ=MONTHLY;BYDAY=-1FR;COUNT=3', dtstart, timezone: LA })
    expect(dates.map(d => inZone(d).toISODate())).toEqual([
      '2026-01-06', '2026-01-30', '2026-02-27'
    ])
  })

  it('skips months without the anchor day-of-month', () => {
    const jan31 = DateTime.fromObject({ year: 2026, month: 1, day: 31, hour: 12 }, { zone: LA }).toJSDate()
    const dates = expandRecurrenceRule({ rule: 'FREQ=MONTHLY;COUNT=4', dtstart: jan31, timezone: LA })
    expect(dates.map(d => inZone(d).toISODate())).toEqual([
      '2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31'
    ])
  })

  it('expands yearly rules and skips Feb 29 in non-leap years', () => {
    const feb29 = DateTime.fromObject({ year: 2024, month: 2, day: 29, hour: 10 }, { zone: 'UTC' }).toJSDate()
    const dates = expandRecurrenceRule({ rule: 'FREQ=YEARLY;COUNT=3', dtstart: feb29, timezone: 'UTC' })
    expect(dates.map(d => inZone(d, 'UTC').toISODate())).toEqual([
      '2024-02-29', '2028-02-29', '2032-02-29'
    ])
  })

  it('stops at UNTIL, read as end-of-day in the event timezone', () => {
    const dates = expandRecurrenceRule({ rule: 'FREQ=WEEKLY;UNTIL=20260120', dtstart, timezone: LA })
    expect(dates.map(d => inZone(d).toISODate())).toEqual([
      '2026-01-06', '2026-01-13', '2026-01-20'
    ])
  })

  it('only returns occurrences strictly after `after`, while still consuming COUNT from dtstart', () => {
    const after = DateTime.fromObject({ year: 2026, month: 1, day: 13, hour: 18 }, { zone: LA }).toJSDate()
    const dates = expandRecurrenceRule({ rule: 'FREQ=WEEKLY;COUNT=4', dtstart, timezone: LA, after })
    // Series is Jan 6, 13, 20, 27; the first two are consumed by `after`
    expect(dates.map(d => inZone(d).toISODate())).toEqual(['2026-01-20', '2026-01-27'])
  })

  it('caps unbounded rules at MAX_FUTURE_OCCURRENCES and respects a lower limit', () => {
    expect(expandRecurrenceRule({ rule: 'FREQ=DAILY', dtstart, timezone: LA }))
      .toHaveLength(MAX_FUTURE_OCCURRENCES)
    expect(expandRecurrenceRule({ rule: 'FREQ=DAILY', dtstart, timezone: LA, limit: 5 }))
      .toHaveLength(5)
    expect(expandRecurrenceRule({ rule: 'FREQ=DAILY', dtstart, timezone: LA, limit: 500 }))
      .toHaveLength(MAX_FUTURE_OCCURRENCES)
  })
})
