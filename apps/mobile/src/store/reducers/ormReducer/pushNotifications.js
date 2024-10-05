import { RECEIVE_PUSH_NOTIFICATION } from 'store/actions/receivePushNotification'
import { showMessagesBadge } from 'store/reducers/ormReducer/util'

export default function (session, action) {
  const { type, payload: notification } = action
  if (type !== RECEIVE_PUSH_NOTIFICATION) return

  const { path } = notification.payload.additionalData
  if (path.startsWith('/t/')) {
    showMessagesBadge(session)
  }

  // TODO toggle notifications list icon badge
}
