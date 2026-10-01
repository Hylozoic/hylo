import { UPDATE_NOTIFICATION_SETTINGS } from 'store/constants'

// Only the settings passed in `changes` are sent, so the backend leaves the rest as they are.
// `changes.unsubscribeScope` saves one of the page's unsubscribe choices ('digest_only',
// 'no_group_emails', 'all_but_direct' or 'everything'), and 'none' removes it.
export default function updateNoticationSettings (token, changes = {}) {
  return {
    type: UPDATE_NOTIFICATION_SETTINGS,
    payload: {
      api: {
        path: '/noo/user/update-notification-settings',
        method: 'POST',
        params: { token, ...changes }
      }
    }
  }
}
