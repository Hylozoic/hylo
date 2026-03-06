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
//
// pushMetadata (optional) may include:
//   title       - bold heading (maps to iOS notification title)
//   subtitle    - second line (maps to iOS notification subtitle)
//   imageUrl    - avatar URL of the actor (user who triggered the notification)
//   groupImageUrl - avatar URL of the group (for group-context notifications)
//   actorName   - display name of the actor
//   groupName   - display name of the group
//   notificationType - 'dm' | 'group' | 'system'
function createNotificationObject ({ readerId, alert, path, appId, badgeNo, pushMetadata }) {
  if (!readerId) {
    throw new Error('Need a readerId to send a push notification')
  }

  const notification = new OneSignal.Notification()
  notification.app_id = appId || process.env.ONESIGNAL_APP_ID

  notification.include_aliases = {
    external_id: [readerId]
  }

  notification.target_channel = 'push'

  // Structured title / subtitle / body
  if (pushMetadata?.title) {
    notification.headings = { en: pushMetadata.title }
  }
  if (pushMetadata?.subtitle) {
    notification.subtitle = { en: pushMetadata.subtitle }
  }

  // Body: use the structured body if provided, otherwise fall back to the
  // legacy single-string alert
  if (pushMetadata?.body) {
    notification.contents = { en: pushMetadata.body }
  } else if (alert) {
    notification.contents = { en: alert }
  }

  // if (path) notification.app_url = 'hyloapp://groups/heart-orchard/stream/post/78041' // IN LOCAL DEV: YOU CAN PUT ANY PRODUCTION LINK HERE, SET THE CORRECT ENV VARIABLES AND IT WILL GENERATE A REAL PUSH NOTIF IF THE USER EXISTS IN PROD AND THE LOCAL DB
  if (path) notification.app_url = 'hyloapp:/' + path

  if (badgeNo) {
    notification.ios_badgeType = 'SetTo'
    notification.ios_badgeCount = badgeNo
  }

  // Always enable mutable_content so the iOS Notification Service Extension
  // can enrich the notification (download avatars, create Communication
  // Notifications with INSendMessageIntent, etc.)
  notification.mutable_content = true

  // Pass rich metadata as custom data so the NSE can build a
  // Communication Notification (iOS 15+)
  if (pushMetadata) {
    notification.data = {
      ...(pushMetadata.imageUrl && { imageUrl: pushMetadata.imageUrl }),
      ...(pushMetadata.groupImageUrl && { groupImageUrl: pushMetadata.groupImageUrl }),
      ...(pushMetadata.actorName && { actorName: pushMetadata.actorName }),
      ...(pushMetadata.groupName && { groupName: pushMetadata.groupName }),
      ...(pushMetadata.notificationType && { notificationType: pushMetadata.notificationType })
    }
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
