import { createStore } from 'redux'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import createMiddleware from './middleware'
import { createBrowserHistory } from 'history'
import { createReduxHistoryContext } from 'redux-first-history'
import createRootReducer, { createCombinedReducers } from './reducers'

const {
  createReduxHistory,
  routerMiddleware,
  routerReducer
} = createReduxHistoryContext({ history: createBrowserHistory() })

export function getEmptyState () {
  const combinedReducers = createCombinedReducers(routerReducer)
  return combinedReducers({}, { type: '' })
}

// Persist ORM entities plus queryResults (feed/list ordering keys). Without
// queryResults, re-open shows empty lists until FETCH_POSTS completes even when
// Post rows exist in the ORM — pending + empty ids caused skeleton/spinner flashes.
// pending, router, and UI slices stay ephemeral.
// Version bump here will purge and re-hydrate all clients.
const persistConfig = {
  key: 'hylo',
  storage,
  whitelist: ['orm', 'queryResults'],
  version: 1.1
}

const store = createStore(
  persistReducer(persistConfig, createRootReducer(routerReducer)),
  getEmptyState(),
  createMiddleware(routerMiddleware)
)

export const persistor = persistStore(store)
export const history = createReduxHistory(store)

export default store
