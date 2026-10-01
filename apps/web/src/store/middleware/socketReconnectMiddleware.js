import { LOGIN } from '../constants'
import { REGISTER, VERIFY_EMAIL } from 'routes/NonAuthLayoutRouter/Signup/Signup.store'
import { reconnectSocket } from 'client/websockets'

const SESSION_CHANGING_ACTIONS = [LOGIN, REGISTER, VERIFY_EMAIL]

/**
 * Reconnects the socket once a login-type action has settled, because the backend
 * gives the browser a new session cookie on login.
 */
export default function socketReconnectMiddleware (store) {
  return next => action => {
    const result = next(action)
    const settled = !action.error && typeof action.payload?.then !== 'function'
    if (SESSION_CHANGING_ACTIONS.includes(action.type) && settled) {
      reconnectSocket()
    }
    return result
  }
}
