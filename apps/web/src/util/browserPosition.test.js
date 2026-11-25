import { getBrowserPosition } from './browserPosition'

describe('getBrowserPosition', () => {
  const originalGeolocation = navigator.geolocation

  afterEach(() => {
    navigator.geolocation = originalGeolocation
  })

  it('passes the browser position on as lat/lng', () => {
    navigator.geolocation = {
      getCurrentPosition: jest.fn(success => success({ coords: { latitude: 51.5, longitude: -0.12 } }))
    }
    const onPosition = jest.fn()

    expect(getBrowserPosition(onPosition)).toBe(true)
    expect(onPosition).toHaveBeenCalledWith({ lat: 51.5, lng: -0.12 })
  })

  it('does nothing when the browser has no geolocation', () => {
    navigator.geolocation = undefined
    const onPosition = jest.fn()

    expect(getBrowserPosition(onPosition)).toBe(false)
    expect(onPosition).not.toHaveBeenCalled()
  })
})
