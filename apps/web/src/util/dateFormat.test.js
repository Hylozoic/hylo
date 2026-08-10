import { formatLocalizedDate } from './dateFormat'

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

  it('returns null for empty input', () => {
    expect(formatLocalizedDate(null, { style: 'short', locale: 'en-US' })).toBeNull()
  })
})
