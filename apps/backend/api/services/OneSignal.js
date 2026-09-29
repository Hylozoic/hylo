import * as OneSignal from '@onesignal/node-onesignal'
import sentry from '../../lib/sentry'

const authConfig = {}
if (process.env.ONESIGNAL_REST_API_KEY && process.env.ONESIGNAL_APP_ID) {
  authConfig.restApiKey = process.env.ONESIGNAL_REST_API_KEY
  authConfig.appId = process.env.ONESIGNAL_APP_ID
} else if (process.env.NODE_ENV === 'production') {
  // Report rather than throw so a missing key can't stop the server from booting.
  sentry.error(new Error('ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY environment variables are required'))
}

const configuration = OneSignal.createConfiguration(authConfig)
const client = new OneSignal.DefaultApi(configuration)

// Helper function to create notification object for SDK.
// heading, groupKey and collapseKey come from notification/pushGrouping (D42).
function createNotificationObject ({ readerId, alert, path, appId, badgeNo, heading, groupKey, collapseKey }) {
  if (!readerId) {
    throw new Error('Need a readerId to send a push notification')
  }

  const notification = new OneSignal.Notification()
  notification.app_id = appId || process.env.ONESIGNAL_APP_ID

  notification.include_aliases = {
    external_id: [readerId]
  }

  notification.target_channel = 'push'

  if (alert) notification.contents = { en: alert }

  if (heading) notification.headings = { en: heading }

  // Stack a group's pushes together in the tray: iOS threads, Android groups
  if (groupKey) {
    notification.thread_id = groupKey
    notification.android_group = groupKey
    if (heading) notification.summary_arg = heading
  }

  // A later push with the same collapse_id replaces this one (chat rooms only)
  if (collapseKey) notification.collapse_id = collapseKey

  if (path) {
    // Send path in additionalData so the mobile click listener can navigate in-app
    // without iOS calling openURL (which opens Safari before bouncing back to the app).
    // app_url with hyloapp:// is kept alongside as a fallback for older app versions
    // that don't yet have the additionalData click handler — they open the app via
    // the custom scheme as before. Once old versions are no longer in circulation,
    // app_url can be removed.
    notification.data = { path }
    notification.app_url = 'hyloapp:/' + path
  }

  if (badgeNo) {
    notification.ios_badgeType = 'SetTo'
    notification.ios_badgeCount = badgeNo
  }

  return notification
}

module.exports = {
  createNotificationObject,

  // Resolves false when the send fails so callers can leave the push unsent.
  notify: async (opts) => {
    const { readerId } = opts
    try {
      const notification = createNotificationObject(opts)
      return await client.createNotification(notification)
    } catch (e) {
      const err = e instanceof Error ? e : new Error(e)
      sentry.error(err, null, {
        readerId,
        response: err.response
      })
      return false
    }
  }
}
