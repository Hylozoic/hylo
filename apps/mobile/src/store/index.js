import { applyMiddleware, createStore as reduxCreateStore, compose } from 'redux'
import createRootReducer from 'store/reducers'
import middleware from 'store/middleware'

export const initialState = {}

export function getEmptyState (state = initialState) {
  return createRootReducer()(state, { type: '' })
}

export function createStore (state = initialState) {
  const store = reduxCreateStore(
    createRootReducer(),
    getEmptyState(state),
    compose(applyMiddleware(...middleware))
  )

  // Enable Webpack hot module replacement for reducers
  if (module.hot) {
    module.hot.accept(() => {
      const nextRootReducer = require('./reducers').default
      store.replaceReducer(nextRootReducer)
    })
  }

  return store
}

const store = createStore()

export default store
