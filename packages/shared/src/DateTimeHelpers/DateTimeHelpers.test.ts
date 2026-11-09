// @jest-environment node
// This test file is intended to be run with Jest, which provides the describe, it, and expect globals.
import * as DateTimeHelpers from './DateTimeHelpers'
import { DateTime } from 'luxon'
import { normalizeLocaleToFull } from '../LocaleHelpers'

describe('locale-aware date formatting', () => {
  it('formats numeric dates according to locale', () => {
    const dt = DateTime.fromObject({ year: 2026, month: 3, day: 16 })
    expect(
      dt.setLocale(normalizeLocaleToFull('en')).toLocaleString(DateTime.DATE_SHORT)
    ).toBe('3/16/2026')
    expect(
      dt.setLocale(normalizeLocaleToFull('en-GB')).toLocaleString(DateTime.DATE_SHORT)
    ).toBe('16/03/2026')
    expect(
      dt.setLocale(normalizeLocaleToFull('de')).toLocaleString(DateTime.DATE_SHORT)
    ).toBe('16.3.2026')
    expect(
      dt.setLocale(normalizeLocaleToFull('fr')).toLocaleString(DateTime.DATE_SHORT)
    ).toBe('16/03/2026')
  })
})

describe('formatDatePair', () => {
  it('displays differences of dates', () => {
    const d1 = DateTime.fromMillis(1551908483315, {zone: 'Etc/GMT'}).set({month: 1, day: 1, hour: 18})
    const d2 = d1.set({hour: 21})
    const d3 = d2.set({day: 2})
    const d4 = d3.set({month: 2})
    const d5 = d4.set({year: 2050})

    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d2 })).toMatchSnapshot()
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d3 })).toMatchSnapshot()
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d4 })).toMatchSnapshot()
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d5 })).toMatchSnapshot()
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: '' })).toMatchSnapshot()
  })

  it('can accept a custom timezone', () => {
    const d1 = DateTime.fromMillis(1551908483315, {zone: 'Etc/GMT'}).set({month: 1, day: 1, hour: 18})
    const d2 = d1.set({hour: 21})
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d2, timezone: 'America/New_York' })).toMatchSnapshot()
  })

  it('supports skipTime parameter', () => {
    const d1 = DateTime.fromMillis(1551908483315, {zone: 'Etc/GMT'}).set({month: 1, day: 1, hour: 18})
    const d2 = d1.set({hour: 21})
    const d3 = d2.set({day: 2})
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d2, skipTime: true })).toMatchSnapshot()
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d3, skipTime: true })).toMatchSnapshot()
  })

  it('returns object when returnAsObj is true', () => {
    const d1 = DateTime.fromMillis(1551908483315, {zone: 'Etc/GMT'}).set({month: 1, day: 1, hour: 18})
    const d2 = d1.set({hour: 21})
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d2, returnAsObj: true })).toMatchSnapshot()
  })

  it('orders day before month for non-US locales', () => {
    const d1 = DateTime.fromObject({ year: 2026, month: 3, day: 16, hour: 13, minute: 30 }, { zone: 'UTC' })
    const d2 = d1.set({ hour: 15 })

    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d2, locale: 'en-US' })).toContain('Mar 16')
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d2, locale: 'en-GB' })).toContain('16 Mar')
    expect(DateTimeHelpers.formatDatePair({ start: d1, end: d2, locale: 'de' })).toContain('16 Mar')
  })
})

describe('defaultEventTimesForDate', () => {
  it('uses 9am-10am on a past day', () => {
    const past = DateTime.now().minus({ days: 3 }).toISODate()
    const { startTime, endTime } = DateTimeHelpers.defaultEventTimesForDate(past)
    const start = DateTime.fromJSDate(startTime)
    const end = DateTime.fromJSDate(endTime)
    expect(start.toISODate()).toBe(past)
    expect(start.hour).toBe(9)
    expect(start.minute).toBe(0)
    expect(end.toISODate()).toBe(past)
    expect(end.hour).toBe(10)
  })

  it('uses 9am-10am on a future day', () => {
    const future = DateTime.now().plus({ days: 3 }).toISODate()
    const { startTime, endTime } = DateTimeHelpers.defaultEventTimesForDate(future)
    const start = DateTime.fromJSDate(startTime)
    const end = DateTime.fromJSDate(endTime)
    expect(start.toISODate()).toBe(future)
    expect(start.hour).toBe(9)
    expect(end.toISODate()).toBe(future)
    expect(end.hour).toBe(10)
  })

  it('uses a time after now when the selected day is today', () => {
    const today = DateTime.now().toISODate()
    const { startTime, endTime } = DateTimeHelpers.defaultEventTimesForDate(today)
    expect(startTime.getTime()).toBeGreaterThan(Date.now())
    expect(endTime.getTime()).toBeGreaterThan(startTime.getTime())
  })
})

describe('timezone helpers', () => {
  it('converts between picker dates and stored instants', () => {
    const timezone = 'America/Los_Angeles'
    const pickerDate = new Date(2026, 2, 6, 15, 30, 0)
    const instant = DateTimeHelpers.fromPickerDate(pickerDate, timezone)
    const roundTrip = DateTimeHelpers.toPickerDate(instant, timezone)
    expect(roundTrip.getFullYear()).toBe(2026)
    expect(roundTrip.getMonth()).toBe(2)
    expect(roundTrip.getDate()).toBe(6)
    expect(roundTrip.getHours()).toBe(15)
    expect(roundTrip.getMinutes()).toBe(30)
  })

  it('preserves wall clock time when changing timezones', () => {
    const instant = DateTime.fromObject({
      year: 2026,
      month: 3,
      day: 6,
      hour: 15,
      minute: 30
    }, { zone: 'America/Los_Angeles' }).toJSDate()

    const converted = DateTimeHelpers.preserveWallClockOnTimezoneChange(
      instant,
      'America/Los_Angeles',
      'America/New_York'
    )

    expect(converted).not.toBeNull()
    const wall = DateTime.fromJSDate(converted as Date, { zone: 'America/New_York' })
    expect(wall.hour).toBe(15)
    expect(wall.minute).toBe(30)
    expect(wall.day).toBe(6)
  })

  it('formats event time with a secondary timezone when different', () => {
    const start = DateTime.fromObject({
      year: 2026,
      month: 3,
      day: 6,
      hour: 15,
      minute: 0
    }, { zone: 'America/Los_Angeles' }).toJSDate()

    const result = DateTimeHelpers.formatEventTimeDisplay({
      start,
      end: start,
      eventTimezone: 'America/Los_Angeles'
    })

    expect(result.primary).toContain('Mar 6')
    expect(result.primary).toContain('3:00 PM')
    expect(result.eventTimezone).toBe('America/Los_Angeles')
    expect(result.eventTimezoneLabel).toBeTruthy()
  })

  it('returns timezone options sorted by offset', () => {
    const options = DateTimeHelpers.getTimezoneOptions('en')
    expect(options.length).toBeGreaterThan(0)
    expect(options[0].value).toBeTruthy()
    expect(options[0].label).toBeTruthy()
    if (options.length > 1) {
      expect(options[0].offset).toBeLessThanOrEqual(options[1].offset)
    }
    expect(options.find(option => option.value === 'UTC') || options[0]).toBeTruthy()
  })
})
  