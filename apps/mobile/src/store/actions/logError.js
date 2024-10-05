import { LOG_ERROR } from 'store/constants'

// @deprecated Use Sentry.captureError instead
export default function logError (error, extra) {
  return {
    type: LOG_ERROR,
    payload: {
      api: { method: 'post', path: '/noo/mobile/logerror', params: { error, extra } }
    }
  }
}
