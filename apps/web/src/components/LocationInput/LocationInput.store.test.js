/* eslint-env jest */
import { get } from 'lodash/fp'
import { ensureLocationIdIfCoordinate } from './LocationInput.store'

describe('ensureLocationIdIfCoordinate', () => {
  it('creates a location from a map-click lat, lng string when locationId is missing', async () => {
    const fetchLocation = jest.fn().mockResolvedValue({
      payload: {
        data: {
          findOrCreateLocation: { id: 'loc-1' }
        }
      },
      meta: {
        extractModel: {
          getRoot: get('findOrCreateLocation')
        }
      }
    })

    const locationId = await ensureLocationIdIfCoordinate({
      fetchLocation,
      location: '37.7749, -122.4194',
      locationId: null
    })

    expect(locationId).toBe('loc-1')
    expect(fetchLocation).toHaveBeenCalledWith(expect.objectContaining({
      center: { lat: 37.7749, lng: -122.4194 },
      fullText: '37.7749, -122.4194'
    }))
  })

  it('returns the existing locationId for a named place', async () => {
    const fetchLocation = jest.fn()

    const locationId = await ensureLocationIdIfCoordinate({
      fetchLocation,
      location: "Joanna's house",
      locationId: 'existing'
    })

    expect(locationId).toBe('existing')
    expect(fetchLocation).not.toHaveBeenCalled()
  })
})
