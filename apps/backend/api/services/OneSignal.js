import * as OneSignal from '@onesignal/node-onesignal'
import rollbar from '../../lib/rollbar'

const authConfig = {}
if (process.env.ONESIGNAL_REST_API_KEY && process.env.ONESIGNAL_APP_ID) {
  authConfig.restApiKey = process.env.ONESIGNAL_REST_API_KEY
  authConfig.appId = process.env.ONESIGNAL_APP_ID
} else {
  if (!process.env.NODE_ENV === 'development') {
    throw new Error('ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY environment variables are required')
  }
}

const configuration = OneSignal.createConfiguration(authConfig)
const client = new OneSignal.DefaultApi(configuration)

// Helper function to create notification object for SDK
function createNotificationObject ({ readerId, alert, path, badgeNo, appId }) {
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
  // if (path) notification.url = 'https://www.hylo.com/groups/heart-orchard/stream/post/78041' || path // IF WE DO THIS, DEEP LINKING FAILS TO PICK UP THE URL
  if (path) notification.app_url = 'hyloapp://groups/heart-orchard/stream/post/78041' || path // This works for iOS, but not Android... Android doesn't even open the app

  return notification
}

module.exports = {
  notify: async (opts) => {
    const { readerId } = opts
    try {
      const notification = createNotificationObject(opts)
      return await client.createNotification(notification)
    } catch (e) {
      const err = e instanceof Error ? e : new Error(e)
      rollbar.error(err, null, {
        readerId,
        response: err.response
      })
    }
  }
}
