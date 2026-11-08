import { geoShapeForApi, groupFieldLoaded, spaceLocation } from './spaceLocation'

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

describe('groupFieldLoaded', () => {
  it('is true only after the attribute has been written, including null', () => {
    expect(groupFieldLoaded({ ref: { location: null } }, 'location')).toBe(true)
    expect(groupFieldLoaded({ ref: { name: 'Oak' } }, 'location')).toBe(false)
    expect(groupFieldLoaded(null, 'location')).toBe(false)
  })
})

describe('geoShapeForApi', () => {
  const polygon = { type: 'Polygon', coordinates: [] }

  it('passes a string through and serializes an object', () => {
    expect(geoShapeForApi(JSON.stringify(polygon))).toBe(JSON.stringify(polygon))
    expect(geoShapeForApi(polygon)).toBe(JSON.stringify(polygon))
  })

  it('returns null when there is no boundary', () => {
    expect(geoShapeForApi(null)).toBeNull()
    expect(geoShapeForApi('')).toBeNull()
  })
})
