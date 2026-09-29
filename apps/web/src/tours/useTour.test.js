/* eslint-env jest */
import React from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { driver } from 'driver.js'
import orm from 'store/models'
import { generateStore } from 'util/testing/reactTestingLibraryExtended'
import updateUserSettings from 'store/actions/updateUserSettings'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import useTour, { tourLayout } from './useTour'

jest.mock('driver.js', () => ({ driver: jest.fn() }))
jest.mock('store/actions/updateUserSettings', () => jest.fn(changes => ({ type: 'TEST_UPDATE_USER_SETTINGS', changes })))
jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn((eventName, data) => ({ type: 'TEST_TRACK_ANALYTICS_EVENT', eventName, data })))

const steps = [
  { popover: { title: 'First' } },
  { popover: { title: 'Second' } }
]

let driverConfig
let driverInstance

function setupStore (settings = {}) {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '1', name: 'Test User', settings: { toursSeen: [], ...settings } })
  return generateStore({ orm: session.state })
}

function wrapperFor (store) {
  return ({ children }) => (
    <Provider store={store}>
      <MemoryRouter>{children}</MemoryRouter>
    </Provider>
  )
}

function trackedEvents () {
  return trackAnalyticsEvent.mock.calls.map(([eventName, data]) => ({ eventName, ...data }))
}

beforeEach(() => {
  updateUserSettings.mockClear()
  trackAnalyticsEvent.mockClear()
  driver.mockImplementation(config => {
    driverConfig = config
    driverInstance = {
      drive: jest.fn(),
      destroy: jest.fn(() => config.onDestroyed())
    }
    return driverInstance
  })
})

describe('useTour', () => {
  it('records a tour finished with Done as completed, with the step it ended on', () => {
    const store = setupStore()
    const { result } = renderHook(() => useTour({ id: 'test-tour', steps }), { wrapper: wrapperFor(store) })

    act(() => { result.current.startTour() })
    act(() => { driverConfig.onHighlighted(undefined, steps[1], { index: 1 }) })
    act(() => { driverConfig.onDoneClick(undefined, steps[1], { driver: driverInstance }) })

    expect(updateUserSettings).toHaveBeenCalledWith({
      settings: { toursOutcome: { test_tour: 'completed' }, toursSeen: ['test-tour'] }
    })
    expect(trackedEvents()).toEqual([
      { eventName: 'Tour Completed', tourId: 'test-tour', stepIndex: 1, stepCount: 2, layout: 'sidebar' }
    ])
  })

  it('records a tour closed early as dismissed', () => {
    const store = setupStore({ globalNavStyle: 'tabs' })
    const { result } = renderHook(() => useTour({ id: 'test-tour', steps }), { wrapper: wrapperFor(store) })

    act(() => { result.current.startTour() })
    act(() => { driverConfig.onHighlighted(undefined, steps[0], { index: 0 }) })
    act(() => { driverInstance.destroy() })

    expect(updateUserSettings).toHaveBeenCalledWith({
      settings: { toursOutcome: { test_tour: 'dismissed' }, toursSeen: ['test-tour'] }
    })
    expect(trackedEvents()).toEqual([
      { eventName: 'Tour Dismissed', tourId: 'test-tour', stepIndex: 0, stepCount: 2, layout: 'top-bar' }
    ])
  })

  it('keeps the outcome of a replayed tour without adding it to the seen list twice', () => {
    const store = setupStore({ toursSeen: ['test-tour'] })
    const { result } = renderHook(() => useTour({ id: 'test-tour', steps }), { wrapper: wrapperFor(store) })

    act(() => { result.current.startTour() })
    act(() => { driverConfig.onDoneClick(undefined, steps[1], { driver: driverInstance }) })

    expect(updateUserSettings).toHaveBeenCalledWith({ settings: { toursOutcome: { test_tour: 'completed' } } })
  })

  describe('invitations', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      window.localStorage.clear()
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    function Harness () {
      const { invitation } = useTour({ id: 'invited-tour', steps, autoStart: true, inviteMessage: 'Want a tour?' })
      return invitation
    }

    function renderInvitation () {
      const store = setupStore()
      render(<Harness />, { wrapper: wrapperFor(store) })
      act(() => { jest.advanceTimersByTime(300) })
      act(() => { jest.advanceTimersByTime(2000) })
      act(() => { jest.advanceTimersByTime(1000) })
    }

    it('reports the offer and a decline, and records the decline as dismissed', () => {
      renderInvitation()
      expect(screen.getByText('Want a tour?')).toBeInTheDocument()
      expect(trackedEvents()).toEqual([
        { eventName: 'Tour Offered', tourId: 'invited-tour', stepIndex: null, layout: 'sidebar', via: 'invitation' }
      ])

      fireEvent.click(screen.getByTestId('tour-invite-decline'))

      expect(trackedEvents()[1]).toEqual({ eventName: 'Tour Dismissed', tourId: 'invited-tour', stepIndex: null, layout: 'sidebar' })
      expect(updateUserSettings).toHaveBeenCalledWith({
        settings: { toursOutcome: { invited_tour: 'dismissed' }, toursSeen: ['invited-tour'] }
      })
    })

    it('reports an accepted invitation and starts the tour', () => {
      renderInvitation()

      fireEvent.click(screen.getByTestId('tour-invite-accept'))

      expect(trackedEvents()[1]).toEqual({ eventName: 'Tour Accepted', tourId: 'invited-tour', stepIndex: 0, layout: 'sidebar' })
      expect(driverInstance.drive).toHaveBeenCalled()
      expect(updateUserSettings).not.toHaveBeenCalled()
    })
  })
})

describe('tourLayout', () => {
  it('names the navigation layout', () => {
    expect(tourLayout({ globalNavStyle: 'tabs' })).toBe('top-bar')
    expect(tourLayout({ globalNavStyle: 'sidebar' })).toBe('sidebar')
    expect(tourLayout(undefined)).toBe('sidebar')
  })
})
