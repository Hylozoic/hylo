import { toMinuteIsoOrNull } from './spaceFormConstants'

describe('toMinuteIsoOrNull', () => {
  it('truncates seconds and milliseconds', () => {
    expect(toMinuteIsoOrNull(new Date('2026-10-21T14:30:45.123Z'))).toBe('2026-10-21T14:30:00.000Z')
    expect(toMinuteIsoOrNull('2026-10-21T14:30:45.123Z')).toBe('2026-10-21T14:30:00.000Z')
  })

  it('does not mutate the Date it is given', () => {
    const date = new Date('2026-10-21T14:30:45.123Z')
    toMinuteIsoOrNull(date)
    expect(date.toISOString()).toBe('2026-10-21T14:30:45.123Z')
  })

  it('returns null for empty or invalid values', () => {
    expect(toMinuteIsoOrNull(null)).toBeNull()
    expect(toMinuteIsoOrNull(undefined)).toBeNull()
    expect(toMinuteIsoOrNull('nope')).toBeNull()
  })
})
