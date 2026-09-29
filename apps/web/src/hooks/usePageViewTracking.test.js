import React from 'react'
import { act, render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { applyMiddleware, createStore } from 'redux'
import mixpanel from 'mixpanel-browser'
import { AnalyticsEvents } from '@hylo/shared'
import { getCookieConsent } from 'util/cookieConsent'
import { isSandboxMode } from 'sandbox/isSandbox'
import mixpanelMiddleware from 'store/middleware/mixpanelMiddleware'
import orm from 'store/models'
import useEmailClickthrough from './useEmailClickthrough'
import usePageViewTracking, { PAGE_VIEW_SETTLE_MS } from './usePageViewTracking'

// The shared test setup stubs useLocation; these tests need the real router
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom'))

jest.mock('sandbox/isSandbox', () => ({
  isSandboxMode: jest.fn(() => false)
}))

let navigateTo

function Harness () {
  useEmailClickthrough()
  usePageViewTracking()
  navigateTo = useNavigate()
  return null
}

// me: the Me row as CheckLogin or MeQuery leave it (signed in only)
function makeStore (status = 'anonymous', me) {
  const session = orm.session(orm.getEmptyState())
  if (me) session.Me.create({ id: '1', name: 'Test User', ...me })
  const reducer = (state = { authSession: { status }, orm: session.state }, action) => {
    if (action.type === 'SET_STATUS') return { ...state, authSession: { status: action.status } }
    if (action.type === 'SET_ME') {
      const next = orm.session(state.orm)
      next.Me.withId('1').update(action.me)
      return { ...state, orm: next.state }
    }
    return state
  }
  return createStore(reducer, applyMiddleware(mixpanelMiddleware))
}

function renderAt (url, store = makeStore()) {
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[url]}>
        <Harness />
      </MemoryRouter>
    </Provider>
  )
  return store
}

const settle = () => act(async () => { jest.advanceTimersByTime(PAGE_VIEW_SETTLE_MS + 1) })
const pageViews = () => mixpanel.track.mock.calls.filter(([name]) => name === AnalyticsEvents.PAGE_VIEWED)

beforeEach(() => {
  jest.useFakeTimers()
  process.env.VITE_MIXPANEL_TOKEN = 'test-token'
  mixpanel.track.mockClear()
  mixpanel.identify.mockClear()
  getCookieConsent.mockReturnValue(null)
  isSandboxMode.mockReturnValue(false)
})

afterEach(() => {
  jest.useRealTimers()
  getCookieConsent.mockReturnValue(null)
})

describe('usePageViewTracking', () => {
  it('sends the route pattern, never the address', async () => {
    renderAt('/groups/garden-club/post/123?token=abc')
    await settle()

    expect(pageViews()).toEqual([[AnalyticsEvents.PAGE_VIEWED, {
      route: '/groups/:groupSlug/post/:postId',
      $current_url: 'http://localhost/groups/:groupSlug/post/:postId'
    }]])
    expect(JSON.stringify(mixpanel.track.mock.calls)).not.toMatch(/garden-club|123|abc/)
  })

  it('sends nothing when analytics were rejected', async () => {
    getCookieConsent.mockReturnValue({ analytics: false, support: true })
    renderAt('/groups/garden-club/stream')
    await settle()
    expect(mixpanel.track).not.toHaveBeenCalled()
  })

  it('sends nothing in the sandbox demo', async () => {
    isSandboxMode.mockReturnValue(true)
    renderAt('/groups/garden-club/stream')
    await settle()
    expect(mixpanel.track).not.toHaveBeenCalled()
  })

  it('counts each new page once and skips pages passed through on a redirect', async () => {
    renderAt('/groups/garden-club/stream')
    await act(async () => { navigateTo('/groups/garden-club/all', { replace: true }) })
    await settle()
    expect(pageViews().map(([, props]) => props.route)).toEqual(['/groups/:groupSlug/all'])

    await act(async () => { navigateTo('/groups/garden-club/all?search=x') })
    await settle()
    expect(pageViews()).toHaveLength(1)

    await act(async () => { navigateTo('/members/42') })
    await settle()
    expect(pageViews().map(([, props]) => props.route)).toEqual(['/groups/:groupSlug/all', '/members/:personId'])
  })

  it('waits until the session is known', async () => {
    const store = renderAt('/groups/garden-club/stream', makeStore('unknown'))
    await settle()
    expect(pageViews()).toHaveLength(0)

    await act(async () => { store.dispatch({ type: 'SET_STATUS', status: 'anonymous' }) })
    await settle()
    expect(pageViews()).toHaveLength(1)
  })

  it('counts an email link only after its tags are removed from the address', async () => {
    renderAt('/groups/garden-club/post/7?ctt=post_email&cti=42&ctcn=Garden')
    await settle()

    expect(pageViews()).toHaveLength(1)
    expect(JSON.stringify(mixpanel.track.mock.calls)).not.toMatch(/ctt|cti|ctcn|Garden|42/)
  })

  describe('for a signed-in person without the cookie', () => {
    it("waits for the account's choice, and sends nothing when it rejects analytics", async () => {
      const store = renderAt('/groups/garden-club/stream', makeStore('authenticated', {}))
      await settle()
      expect(mixpanel.track).not.toHaveBeenCalled()

      await act(async () => {
        store.dispatch({ type: 'SET_ME', me: { cookieConsentPreferences: { settings: { analytics: false, support: true } } } })
      })
      await settle()
      expect(mixpanel.track).not.toHaveBeenCalled()
    })

    it.each([
      ['has no saved choice', null],
      ['accepted analytics', { settings: { analytics: true, support: true } }]
    ])('sends the waiting page view once the account %s', async (_, cookieConsentPreferences) => {
      const store = renderAt('/groups/garden-club/stream', makeStore('authenticated', {}))
      await settle()
      expect(pageViews()).toHaveLength(0)

      await act(async () => { store.dispatch({ type: 'SET_ME', me: { cookieConsentPreferences } }) })
      await settle()
      expect(pageViews().map(([, props]) => props.route)).toEqual(['/groups/:groupSlug/stream'])
      expect(mixpanel.identify).toHaveBeenCalledWith('1')

      await act(async () => { store.dispatch({ type: 'SET_ME', me: { cookieConsentPreferences: cookieConsentPreferences && { ...cookieConsentPreferences } } }) })
      await settle()
      expect(pageViews()).toHaveLength(1)
    })
  })
})
