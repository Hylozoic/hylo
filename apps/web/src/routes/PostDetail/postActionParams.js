// One-time actions that email and notification links ask the post page to take, as
// ?action=<name>. PostDetail handles each once and then removes it from the address,
// so a reload or Back never repeats it.
export const POST_ACTION_PARAM = 'action'

export const POST_ACTIONS = {
  // Post emails: stop notifications for new comments
  UNFOLLOW: 'unfollow',
  // Open request nudge and digest (D58): the author's one-tap answers
  STILL_NEEDED: 'still-needed',
  MET: 'met'
}

// The open request nudge opens the post with ?nudge=open-request, which asks the
// author whether it's still needed (D58)
export const OPEN_REQUEST_NUDGE_PARAM = 'nudge'
export const OPEN_REQUEST_NUDGE_VALUE = 'open-request'

export const OPEN_REQUEST_POST_TYPES = ['request', 'offer']

// What the backend's answerOpenRequestNudge mutation calls each answer
export const OPEN_REQUEST_ANSWERS = {
  [POST_ACTIONS.STILL_NEEDED]: 'still_needed',
  [POST_ACTIONS.MET]: 'met'
}

/** The location without the given query params, for navigate(..., { replace: true }). */
export function locationWithout (location, names) {
  const params = new URLSearchParams(location.search)
  names.forEach(name => params.delete(name))
  const search = params.toString()
  return { pathname: location.pathname, search: search ? `?${search}` : '' }
}

/** The location with one query param set, keeping the rest. */
export function locationWith (location, name, value) {
  const params = new URLSearchParams(location.search)
  params.set(name, value)
  return { pathname: location.pathname, search: `?${params.toString()}` }
}
