import { combineReducers } from 'redux'
import pending from './pending'
import session from './sessionReducer'
import initialURL from './initialURL'
import mixpanel from './mixpanel'
import returnToOnAuthPath from './returnToOnAuthPathReducer'
import resetStore from './resetStore'
import { handleSetState, composeReducers } from './util'
// Local store
import MessageInput from 'components/MessageInput/MessageInput.store'
import PeopleTyping from 'components/PeopleTyping/PeopleTyping.store'
import SocketListener from 'components/SocketListener/SocketListener.store'
import CreateGroupFlow from 'screens/CreateGroupFlow/CreateGroupFlow.store'
import GroupWelcomeFlow from 'screens/GroupWelcomeFlow/GroupWelcomeFlow.store'

export const createCombinedReducers = () => combineReducers({
  // Global store
  pending,
  initialURL,
  session,
  mixpanel,
  returnToOnAuthPath,
  // Local store (Component)
  MessageInput,
  PeopleTyping,
  SocketListener,
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
