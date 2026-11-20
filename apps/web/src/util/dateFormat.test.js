import { endOfDayIso, formatLocalizedDate, toDateInputValue } from './dateFormat'

describe('formatLocalizedDate', () => {
  const date = '2026-03-16T12:00:00.000Z'

  it('formats short numeric dates per locale', () => {
    expect(formatLocalizedDate(date, { style: 'short', locale: 'en-US' })).toBe('3/16/2026')
    expect(formatLocalizedDate(date, { style: 'short', locale: 'en-GB' })).toBe('16/03/2026')
    expect(formatLocalizedDate(date, { style: 'short', locale: 'de-DE' })).toBe('16.3.2026')
  })

  it('formats medium prose dates per locale', () => {
    expect(formatLocalizedDate(date, { style: 'medium', locale: 'en-US' })).toBe('Mar 16, 2026')
    expect(formatLocalizedDate(date, { style: 'medium', locale: 'en-GB' })).toBe('16 Mar 2026')
  })

  it('formats medium dates with times per locale, 12- or 24-hour (Jest runs in UTC)', () => {
    const format = locale => formatLocalizedDate('2026-03-16T14:05:00.000Z', { style: 'mediumDateTime', locale }).replace(/\s/g, ' ')
    expect(format('en-US')).toBe('Mar 16, 2026, 2:05 PM')
    expect(format('en-GB')).toBe('16 Mar 2026, 14:05')
    expect(format('de-DE')).toBe('16. März 2026, 14:05')
  })

  it('returns null for empty input', () => {
    expect(formatLocalizedDate(null, { style: 'short', locale: 'en-US' })).toBeNull()
  })
})

describe('endOfDayIso and toDateInputValue', () => {
  // Jest runs with TZ=UTC, so the end of a local day is 23:59:59Z
  it('round-trips a date input value through the end of that local day', () => {
    expect(endOfDayIso('2027-03-31')).toBe('2027-03-31T23:59:59.000Z')
    expect(toDateInputValue(endOfDayIso('2027-03-31'))).toBe('2027-03-31')
    expect(toDateInputValue(new Date('2027-03-31T10:00:00Z'))).toBe('2027-03-31')
  })

  it('handles empty and invalid values', () => {
    expect(endOfDayIso('')).toBeNull()
    expect(endOfDayIso(null)).toBeNull()
    expect(endOfDayIso('not-a-date')).toBeNull()
    expect(toDateInputValue(null)).toBe('')
    expect(toDateInputValue('not-a-date')).toBe('')
  })
})
