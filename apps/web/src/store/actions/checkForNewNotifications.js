import { get } from 'lodash/fp'
import { CHECK_FOR_NEW_NOTIFICATIONS } from 'store/constants'

export default function checkForNewNotifications () {
  return {
    type: CHECK_FOR_NEW_NOTIFICATIONS,
    graphql: {
      query: `query CheckForNewNotifications {
        me {
          id
          newNotificationCount
          unseenThreadCount
        }
      }`
    },
    meta: {
      extractModel: [
        {
          getRoot: get('me'),
          modelName: 'Me'
        }
      ]
    }
  }
}
