import { UPDATE_NOTIFICATION_SETTINGS } from 'store/constants'

// Only the settings passed in `changes` are sent, so the backend leaves the rest as they are
export default function updateNoticationSettings (token, { unsubscribeAll, ...changes } = {}) {
  return {
    type: UPDATE_NOTIFICATION_SETTINGS,
    payload: {
      api: {
        path: '/noo/user/update-notification-settings',
        method: 'POST',
        params: { token, unsubscribeAll, ...changes }
      }
    }
  }
}
