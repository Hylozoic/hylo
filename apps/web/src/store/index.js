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

// Persist only the ORM slice (user, groups, memberships, posts).
// Everything else (pending flags, UI state, router) stays ephemeral.
// Version bump here will purge and re-hydrate all clients.
const persistConfig = {
  key: 'hylo',
  storage,
  whitelist: ['orm'],
  version: 1
}

const store = createStore(
  persistReducer(persistConfig, createRootReducer(routerReducer)),
  getEmptyState(),
  createMiddleware(routerMiddleware)
)

export const persistor = persistStore(store)
export const history = createReduxHistory(store)

export default store
