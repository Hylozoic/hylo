import { get, isString, isObject, omit } from 'lodash/fp'
import mixpanel from 'services/mixpanel'

export default function mixpanelMiddleware (store) {
  return next => async action => {
    const { type, meta } = action
    if (!type.match(/_PENDING$/) && meta && meta.analytics) {
      // meta.analytics can be either simply true, a string (name of event) or a hash
      // with data that will be attached to the event sent to mixpanel (eventName being
      // a required key).
      //
      // NOTE: the mixpanel object is created during initialization of the mixpanel
      // reducer
      const state = store.getState()

      if (!mixpanel) return next(action)

      const { analytics } = meta
      const trackingEventName = get('eventName', analytics) ||
        (isString(analytics) && analytics) ||
        type
      const analyticsData = isObject(analytics) ? omit('eventName', analytics) : {}
      await mixpanel.track(trackingEventName, analyticsData)
    }
    return next(action)
  }
}
