import { combineReducers } from 'redux'
import pending from './pending'
import session from './sessionReducer'
import initialURL from './initialURL'
import mixpanel from './mixpanel'
import returnToOnAuthPath from './returnToOnAuthPathReducer'
import resetStore from './resetStore'
import { SET_STATE } from 'store/constants'
// Local store
import CreateGroupFlow from 'screens/CreateGroupFlow/CreateGroupFlow.store'
import GroupWelcomeFlow from 'screens/GroupWelcomeFlow/GroupWelcomeFlow.store'

export const composeReducers = (...reducers) => (state, action) =>
  reducers.reduce((newState, reducer) => reducer(newState, action), state)

export const handleSetState = (state = {}, { type, payload }) =>
  type === SET_STATE ? payload : state

export const createCombinedReducers = () => combineReducers({
  // Global store
  pending,
  initialURL,
  session,
  mixpanel,
  returnToOnAuthPath,
  // Local store (Component)
  CreateGroupFlow,
  GroupWelcomeFlow
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
