import { REMEMBER_REHYDRATED } from 'store/bootstrap/rememberConstants'
import { BOOTSTRAP_REPLAY_COMPLETE } from 'store/constants'
import { replayBootstrapIntoOrm } from 'store/bootstrap/replayBootstrapIntoOrm'

export default function bootstrapMiddleware (store) {
  return next => action => {
    const result = next(action)

    if (action.type === REMEMBER_REHYDRATED) {
      replayBootstrapIntoOrm(store.getState().bootstrap, store.dispatch)
      store.dispatch({ type: BOOTSTRAP_REPLAY_COMPLETE })
    }

    return result
  }
}
