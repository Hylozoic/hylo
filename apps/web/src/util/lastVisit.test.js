import { VISIT_GAP_MS, getVisitBaseline, markVisitActive } from './lastVisit'

const USER = '42'
const HOUR = 60 * 60 * 1000
const T0 = new Date('2026-09-01T12:00:00Z').getTime()

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('visit baseline', () => {
  it('has no baseline on a first visit', () => {
    markVisitActive(USER, T0)
    expect(getVisitBaseline(USER)).toBeNull()
  })

  it('uses the time Hylo was last in use as the next visit\'s baseline', () => {
    markVisitActive(USER, T0)
    markVisitActive(USER, T0 + 5 * 60 * 1000)
    // A new tab session the next day
    window.sessionStorage.clear()
    markVisitActive(USER, T0 + 24 * HOUR)
    expect(getVisitBaseline(USER)).toEqual(new Date(T0 + 5 * 60 * 1000))
  })

  it('keeps the same baseline through a visit, including reloads', () => {
    markVisitActive(USER, T0)
    window.sessionStorage.clear()
    markVisitActive(USER, T0 + 3 * HOUR)
    markVisitActive(USER, T0 + 3 * HOUR + 60 * 1000)
    markVisitActive(USER, T0 + 3 * HOUR + 2 * 60 * 1000)
    expect(getVisitBaseline(USER)).toEqual(new Date(T0))
  })

  it('starts a new visit after a long gap in the same tab', () => {
    markVisitActive(USER, T0)
    markVisitActive(USER, T0 + VISIT_GAP_MS + 1)
    expect(getVisitBaseline(USER)).toEqual(new Date(T0))
  })

  it('captures the baseline when read before anything marked the visit', () => {
    markVisitActive(USER, T0)
    window.sessionStorage.clear()
    expect(getVisitBaseline(USER)).toEqual(new Date(T0))
    // The first mark of the visit keeps that baseline
    markVisitActive(USER, T0 + 2 * HOUR)
    expect(getVisitBaseline(USER)).toEqual(new Date(T0))
  })

  it('keeps people on a shared device apart', () => {
    markVisitActive(USER, T0)
    expect(getVisitBaseline('other')).toBeNull()
  })

  it('does nothing without a user', () => {
    markVisitActive(null, T0)
    expect(getVisitBaseline(null)).toBeNull()
    expect(window.localStorage.length).toBe(0)
  })
})
