import { createStore } from 'redux'
import createMiddleware from './middleware'
import { createBrowserHistory } from 'history'
import { createReduxHistoryContext } from 'redux-first-history'
import createRootReducer, { createCombinedReducers } from './reducers'
import { isSandboxMode, SANDBOX_BASENAME } from 'sandbox/isSandbox'

const sandboxBasename = isSandboxMode() ? SANDBOX_BASENAME : undefined

const {
  createReduxHistory,
  routerMiddleware,
  routerReducer
} = createReduxHistoryContext({
  history: createBrowserHistory(),
  basename: sandboxBasename
})

export { sandboxBasename }

export function getEmptyState () {
  const combinedReducers = createCombinedReducers(routerReducer)
  return combinedReducers({}, { type: '' })
}

const store = createStore(
  createRootReducer(routerReducer),
  getEmptyState(),
  createMiddleware(routerMiddleware)
)

export const history = createReduxHistory(store)

export default store
