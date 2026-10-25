import { locationCenter, shapeCenter } from './geo'

describe('locationCenter', () => {
  it('returns lat/lng from a GraphQL locationObject', () => {
    expect(locationCenter({
      center: { lat: 37.8044, lng: -122.2712 }
    })).toEqual({ lat: 37.8044, lng: -122.2712 })
  })

  it('returns null when center is missing', () => {
    expect(locationCenter(null)).toBe(null)
    expect(locationCenter({})).toBe(null)
  })
})

describe('shapeCenter', () => {
  const polygon = {
    type: 'Polygon',
    coordinates: [[
      [-121.498, 38.535],
      [-121.448, 38.535],
      [-121.448, 38.562],
      [-121.498, 38.562],
      [-121.498, 38.535]
    ]]
  }

  it('returns the center of a polygon boundary', () => {
    const center = shapeCenter(polygon)
    expect(center.lng).toBeCloseTo(-121.473, 3)
    expect(center.lat).toBeCloseTo(38.5485, 3)
  })

  it('accepts a JSON string', () => {
    expect(shapeCenter(JSON.stringify(polygon)).lat).toBeCloseTo(38.5485, 3)
  })

  it('returns null when there is no boundary', () => {
    expect(shapeCenter(null)).toBe(null)
    expect(shapeCenter('')).toBe(null)
    expect(shapeCenter({})).toBe(null)
    expect(shapeCenter('not json')).toBe(null)
  })
})
