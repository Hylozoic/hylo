import { createStore } from 'redux'
import { createMigrate, persistStore, persistReducer } from 'redux-persist'
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

// Persist ORM entities plus queryResults (feed/list ordering keys).
// queryResults, pending, router, and UI slices stay ephemeral.
// Version bump here will purge and re-hydrate all clients, running the migration code
const migrations = {
  2: (state) => ({ ...state, orm: undefined, queryResults: undefined }), // wipe out all data and start fresh
  2.1: (state) => ({ ...state, queryResults: undefined }) // stop persisting queryResults
}

const persistConfig = {
  key: 'hylo',
  storage,
  whitelist: ['orm'],
  version: 2.1,
  migrate: createMigrate(migrations, { debug: false })
}

const store = createStore(
  persistReducer(persistConfig, createRootReducer(routerReducer)),
  getEmptyState(),
  createMiddleware(routerMiddleware)
)

export const persistor = persistStore(store)
export const history = createReduxHistory(store)

export default store
