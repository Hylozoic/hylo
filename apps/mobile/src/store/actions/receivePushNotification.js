export const RECEIVE_PUSH_NOTIFICATION = 'RECEIVE_PUSH_NOTIFICATION'

export default function receivePushNotification (notification) {
  return {
    type: RECEIVE_PUSH_NOTIFICATION,
    payload: notification
  }
}
