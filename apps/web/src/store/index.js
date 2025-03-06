import { createStore } from 'redux'
import createMiddleware from './middleware'
// import { createEnhancer, reducer as routerReducer } from 'redux-data-router'
import createRootReducer, { createCombinedReducers } from './reducers'
import router from '../router'

export function getEmptyState () {
  // const combinedReducers = createCombinedReducers(routerReducer)
  const combinedReducers = createCombinedReducers({})
  return combinedReducers({}, { type: '' })
}

const store = createStore(
  // createRootReducer(routerReducer),
  createRootReducer(null),
  getEmptyState(),
  // createMiddleware(createEnhancer(router))
  createMiddleware(null)
)

export default store
