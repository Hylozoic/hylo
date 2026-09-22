import { locationCenter } from './geo'

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
