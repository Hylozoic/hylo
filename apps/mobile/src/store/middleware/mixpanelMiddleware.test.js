import mixpanelMiddleware from './mixpanelMiddleware'

describe('mixpanelMiddleware', () => {
  let mixpanelMiddlewareInstance, mixpanel

  beforeEach(() => {
    mixpanel = {
      track: jest.fn()
    }
    const state = {
      mixpanel
    }
    const store = {
      getState: () => state
    }
    const next = () => {}
    mixpanelMiddlewareInstance = mixpanelMiddleware(store)(next)
  })

  test('when meta.analytics is a string sends tracking event by that name', async () => {
    const eventName = 'Event Name'
    const analyticsAction = {
      type: 'Anything',
      meta: {
        analytics: eventName
      }
    }
    await mixpanelMiddlewareInstance(analyticsAction)
    expect(mixpanel.track).toHaveBeenCalledWith(eventName, {})
  })

  test('when meta.analytics is an object with an eventName sends eventName and data', async () => {
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
    await mixpanelMiddlewareInstance(analyticsAction)
    expect(mixpanel.track).toHaveBeenCalledWith(eventName, eventData)
  })

  test('when meta.analytics is an object without an eventName uses action.type and data', async () => {
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
    await mixpanelMiddlewareInstance(analyticsAction)
    expect(mixpanel.track).toHaveBeenCalledWith(actionType, eventData)
  })
})
