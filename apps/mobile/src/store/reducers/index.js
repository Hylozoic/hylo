import { combineReducers } from 'redux'
import pending from './pending'
import resetStore from './resetStore'
import { SET_STATE } from 'store/constants'

export const composeReducers = (...reducers) => (state, action) =>
  reducers.reduce((newState, reducer) => reducer(newState, action), state)

export const handleSetState = (state = {}, { type, payload }) =>
  type === SET_STATE ? payload : state

export const createCombinedReducers = () => combineReducers({
  pending
})

export default function createRootReducer () {
  return composeReducers(
    createCombinedReducers(),
    /*

      DANGEROUS: These mutate and/or reset the entire state object

      Not sure why then need to added using our `composeReducers`
      utility function with appears to do the same things as redux's
      `combineReducers`. If I remember right correctly this is so these
      somehow run in a 2nd reducer cycle to eliminate an infinite reducer
      update condition? Not convinced they can't just go at the bottom above ^

    */
    resetStore,
    handleSetState
  )
}
