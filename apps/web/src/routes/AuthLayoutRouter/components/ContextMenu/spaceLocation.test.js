import { spaceLocation } from './spaceLocation'

describe('spaceLocation', () => {
  const oakland = { id: '99', fullText: 'Oakland, California' }

  it('returns the related Location when it matches the group', () => {
    expect(spaceLocation({
      locationObject: { ref: oakland },
      ref: { location: oakland.fullText, locationObject: '99' }
    })).toEqual(oakland)
  })

  it('uses the group location string when only the foreign-key id is stored', () => {
    expect(spaceLocation({
      ref: { location: 'Berkeley, California', locationObject: '99' }
    })).toEqual({ id: '99', fullText: 'Berkeley, California' })
  })

  it('returns null when the group has no location', () => {
    expect(spaceLocation({ ref: { locationObject: '99' } })).toBeNull()
    expect(spaceLocation(null)).toBeNull()
  })
})
