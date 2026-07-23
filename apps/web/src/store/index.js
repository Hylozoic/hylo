import { compose, createStore } from 'redux'
import { rememberEnhancer, rememberReducer } from 'redux-remember'
import createMiddleware from './middleware'
import { createBrowserHistory } from 'history'
import { createReduxHistoryContext } from 'redux-first-history'
import createRootReducer, { createCombinedReducers } from './reducers'
import { getBootstrapStorageDriver } from './bootstrap/bootstrapStorageDriver'
import { migrateBootstrapState } from './bootstrap/migrateBootstrapState'
import { BOOTSTRAP_INIT_COMPLETE } from './constants'
import { isTest } from 'config/index'

const {
  createReduxHistory,
  routerMiddleware,
  routerReducer
} = createReduxHistoryContext({ history: createBrowserHistory() })

export function getEmptyState () {
  const combinedReducers = createCombinedReducers(routerReducer)
  return combinedReducers({}, { type: '' })
}

const rememberedKeys = ['bootstrap']
const baseRootReducer = createRootReducer(routerReducer)

const rootReducer = isTest
  ? baseRootReducer
  : rememberReducer(baseRootReducer)

const storeEnhancer = isTest
  ? createMiddleware(routerMiddleware)
  : compose(
    createMiddleware(routerMiddleware),
    rememberEnhancer(getBootstrapStorageDriver(), rememberedKeys, {
      prefix: '@@hylo-remember-',
      persistThrottle: 2000,
      migrate: migrateBootstrapState,
      // Rehydrate only after createReduxHistory seeds router.location — otherwise
      // REMEMBER_REHYDRATED restores router.location: null and breaks HistoryRouter.
      initActionType: BOOTSTRAP_INIT_COMPLETE,
      errorHandler (error) {
        console.warn('[Hylo bootstrap remember]', error)
      }
    })
  )

const store = createStore(
  rootReducer,
  getEmptyState(),
  storeEnhancer
)

export const history = createReduxHistory(store)

if (!isTest) {
  store.dispatch({ type: BOOTSTRAP_INIT_COMPLETE })
}

export default store
