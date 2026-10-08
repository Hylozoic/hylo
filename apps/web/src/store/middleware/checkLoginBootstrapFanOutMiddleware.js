import { isPromise } from 'util/index'
import { CHECK_LOGIN, FETCH_FOR_CURRENT_USER } from 'store/constants'
import checkLogin from 'store/actions/checkLogin'

/**
 * After a combined CHECK_LOGIN (MeQuery), fan out FETCH_FOR_CURRENT_USER with the
 * same payload (no second network call). On MeQuery failure, fall back to light CheckLogin.
 */
export default function checkLoginBootstrapFanOutMiddleware (store) {
  return next => action => {
    const result = next(action)

    const handleResolvedCheckLogin = (resolvedAction) => {
      if (resolvedAction.type !== CHECK_LOGIN || resolvedAction.error) return
      if (!resolvedAction.meta?.fanOutFetchForCurrentUser) return
      if (!resolvedAction.payload?.data) return

      store.dispatch({
        type: FETCH_FOR_CURRENT_USER,
        payload: resolvedAction.payload,
        meta: {
          extractModel: resolvedAction.meta.extractModel,
          fromCheckLoginFanOut: true
        }
      })
    }

    const handleRejectedCombinedCheckLogin = async (initialAction, rejection) => {
      if (!initialAction.meta?.fallbackToLightCheckLogin) {
        throw rejection
      }
      return store.dispatch(checkLogin())
    }

    if (
      action.type === CHECK_LOGIN &&
      action.meta?.fanOutFetchForCurrentUser &&
      isPromise(result)
    ) {
      return result.then(
        resolvedAction => {
          handleResolvedCheckLogin(resolvedAction)
          return resolvedAction
        },
        rejection => handleRejectedCombinedCheckLogin(action, rejection)
      )
    }

    handleResolvedCheckLogin(action)
    return result
  }
}
