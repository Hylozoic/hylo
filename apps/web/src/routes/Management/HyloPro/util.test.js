import { endOfDayIso, formatDate, formatDateTime, formatMoney, toDateInputValue } from './util'

// Jest runs with TZ=UTC (see the test script), so times below are UTC wall-clock times.
// Intl separates times with narrow no-break spaces; normalize them so the expectations stay readable.
const plain = text => text.replace(/\s/g, ' ')
const WHEN = '2026-11-03T14:05:00.000Z'

describe('HyloPro formatting', () => {
  it('formats dates for the Hylo locale, month first only for en-US', () => {
    expect(formatDate(WHEN, 'en-US')).toBe('Nov 3, 2026')
    expect(formatDate(WHEN, 'en-GB')).toBe('3 Nov 2026')
    expect(formatDate(WHEN, 'de-DE')).toBe('3. Nov. 2026')
    expect(formatDate(null, 'en-GB')).toBe('')
  })

  it('formats dates with times, 12- or 24-hour per locale', () => {
    expect(plain(formatDateTime(WHEN, 'en-US'))).toBe('Nov 3, 2026, 2:05 PM')
    expect(plain(formatDateTime(WHEN, 'en-GB'))).toBe('3 Nov 2026, 14:05')
    expect(plain(formatDateTime(WHEN, 'de-DE'))).toBe('3. Nov. 2026, 14:05')
    expect(formatDateTime(undefined, 'en-GB')).toBe('')
  })

  it('formats money for the Hylo locale, naming US dollars where $ could mean another currency', () => {
    expect(formatMoney(1833, 'usd', 'en-US')).toBe('$18.33')
    expect(formatMoney(1833, 'usd', 'en-GB')).toBe('US$18.33')
    expect(plain(formatMoney(1833, 'usd', 'de-DE'))).toBe('18,33 $')
  })

  it('round-trips a date input value through the end of that local day', () => {
    expect(endOfDayIso('2027-03-31')).toBe('2027-03-31T23:59:59.000Z')
    expect(toDateInputValue(endOfDayIso('2027-03-31'))).toBe('2027-03-31')
    expect(endOfDayIso('')).toBeNull()
    expect(toDateInputValue(null)).toBe('')
  })
})
