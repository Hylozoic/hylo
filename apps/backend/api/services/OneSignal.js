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
function createNotificationObject ({ readerId, alert, path, appId, badgeNo, iconUrl }) {
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
  // if (path) notification.app_url = 'hyloapp://groups/heart-orchard/stream/post/78041' // IN LOCAL DEV: YOU CAN PUT ANY PRODUCTION LINK HERE, SET THE CORRECT ENV VARIABLES AND IT WILL GENERATE A REAL PUSH NOTIF IF THE USER EXISTS IN PROD AND THE LOCAL DB
  if (path) notification.app_url = 'hyloapp:/' + path

  if (badgeNo) {
    notification.ios_badgeType = 'SetTo'
    notification.ios_badgeCount = badgeNo
  }

  if (iconUrl) {
    notification.large_icon = iconUrl
    notification.ios_attachments = { id1: iconUrl }
  }

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
