/**

Retrieves the active route from a React Navigation state object.

 This function is designed to handle both stack-based navigation states (which use a `routes[]` array) 
 and nested `params`-based navigation states, which are common in event payloads from `beforeRemove`, 
 `replace`, and similar navigation actions.

 Parameters:
 - state (object): The navigation state object, which can come from `navigation.getState()` 
   or from an event payload.
 - parentRoute (string|null): Optional. The name of a parent route to retrieve. If provided, 
   the function searches the state tree and returns the first matching route.

 Returns:
 - The full route object of the last active screen if `parentRoute` is not provided.
 - The full route object of the specified parent route if found.
 - Null if `parentRoute` was specified but not found.

 Behavior:
 - If `state` is stack-based (`routes[]` exists), starts at the active route (`state.routes[state.index]`).
 - If `parentRoute` matches the top-level route (`name` field), returns it immediately.
 - Iterates down the `params` structure, checking for `screen` at each level.
 - Returns the first match of `parentRoute`, if found.
 - Returns the last active screen if `parentRoute` is not provided.
 - Returns null if `parentRoute` was specified but never found.

 **/
export default function getActiveRoute (state, parentRoute = null) {
  if (!state) return null

  let current = state.routes?.[state.index] || state

  if (parentRoute && current.name === parentRoute) {
    return current
  }

  let foundParent = parentRoute ? false : true

  while (current?.params?.screen) {
    if (parentRoute && current.params.screen === parentRoute) {
      foundParent = true
      return current.params
    }

    current = current.params
  }

  return foundParent ? current : null
}
