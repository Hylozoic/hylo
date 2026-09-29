import orm from 'store/models'
import mixpanelMiddleware from './mixpanelMiddleware'
import mixpanel from 'mixpanel-browser'

jest.mock('mixpanel-browser', () => ({
  track: jest.fn(),
  identify: jest.fn(),
  set_group: jest.fn(),
  get_group: jest.fn()
}))

describe('mixpanelMiddleware', () => {
  let mixpanelMiddlewareInstance
  // The middleware only tracks when a token is configured. Set one here so the
  // suite doesn't depend on a local apps/web/.env (CI has none).
  const originalToken = process.env.VITE_MIXPANEL_TOKEN

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.VITE_MIXPANEL_TOKEN
    } else {
      process.env.VITE_MIXPANEL_TOKEN = originalToken
    }
  })

  beforeEach(() => {
    process.env.VITE_MIXPANEL_TOKEN = 'test-token'
    const session = orm.session(orm.getEmptyState())
    session.Me.create({
      id: '1',
      name: 'Test User',
      hasRegistered: true,
      emailValidated: true,
      settings: {
        signupInProgress: false
      }
    })
    const store = {
      getState: () => ({
        current: {
          loggedIn: false
        },
        authSession: {
          status: 'anonymous',
          userId: null,
          emailValidated: null,
          hasRegistered: null,
          signupInProgress: null,
          checkedAt: null
        },
        orm: session.state
      })
    }
    const next = () => {}
    mixpanelMiddlewareInstance = mixpanelMiddleware(store)(next)
  })

  test('when meta.analytics is a string sends tracking event by that name', () => {
    const eventName = 'Event Name'
    const analyticsAction = {
      type: 'Anything',
      meta: {
        analytics: eventName
      }
    }
    mixpanelMiddlewareInstance(analyticsAction)
    expect(mixpanel.track).toHaveBeenCalledWith(eventName, {})
  })

  test('when meta.analytics is an object with an eventName sends eventName and data', () => {
    const eventName = 'Event Name From Object'
    const eventData = {
      somedata: 'anything'
    }
    const analyticsAction = {
      type: 'Anything',
      meta: {
        analytics: {
          eventName,
          ...eventData
        }
      }
    }
    mixpanelMiddlewareInstance(analyticsAction)
    expect(mixpanel.track).toHaveBeenCalledWith(eventName, eventData)
  })

  test('when meta.analytics is an object without an eventName uses action.type and data', () => {
    const actionType = 'Action Type Name'
    const eventData = {
      somedata: 'anything',
      someotherdata: 'anything2'
    }
    const analyticsAction = {
      type: actionType,
      meta: {
        analytics: {
          ...eventData
        }
      }
    }
    mixpanelMiddlewareInstance(analyticsAction)
    expect(mixpanel.track).toHaveBeenCalledWith(actionType, eventData)
  })

  test('does not track an action that errored', () => {
    mixpanel.track.mockClear()
    const next = jest.fn()
    const store = { getState: () => ({}) }
    const erroredAction = {
      type: 'CREATE_POST',
      error: true,
      payload: new Error('Something went wrong'),
      meta: {
        analytics: { eventName: 'Post Created' }
      }
    }
    mixpanelMiddleware(store)(next)(erroredAction)
    expect(mixpanel.track).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(erroredAction)
  })

  test('does not track a pending action', () => {
    mixpanel.track.mockClear()
    mixpanelMiddlewareInstance({ type: 'CREATE_POST_PENDING', meta: { analytics: 'Post Created' } })
    expect(mixpanel.track).not.toHaveBeenCalled()
  })
})
