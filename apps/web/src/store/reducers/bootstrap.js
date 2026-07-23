import {
  CHECK_LOGIN,
  FETCH_FOR_CURRENT_USER,
  FETCH_FOR_GROUP,
  LOGOUT
} from 'store/constants'

export const BOOTSTRAP_VERSION = 1
export const MAX_CACHED_GROUPS = 5

export function getInitialBootstrapState () {
  return {
    _version: BOOTSTRAP_VERSION,
    checkLogin: null,
    currentUser: null,
    groupsBySlug: {}
  }
}

function capturePayload (payload) {
  if (!payload?.data) return null
  return { data: payload.data, at: Date.now() }
}

function trimGroupsBySlug (groupsBySlug) {
  const entries = Object.entries(groupsBySlug)
  if (entries.length <= MAX_CACHED_GROUPS) return groupsBySlug

  return entries
    .sort(([, a], [, b]) => (b.at || 0) - (a.at || 0))
    .slice(0, MAX_CACHED_GROUPS)
    .reduce((acc, [slug, entry]) => {
      acc[slug] = entry
      return acc
    }, {})
}

export default function bootstrap (state = getInitialBootstrapState(), action) {
  if (action.type === LOGOUT && !action.error) {
    return getInitialBootstrapState()
  }

  if (action.error || !action.payload?.data) return state

  switch (action.type) {
    case CHECK_LOGIN:
      return {
        ...state,
        checkLogin: capturePayload(action.payload)
      }

    case FETCH_FOR_CURRENT_USER:
      return {
        ...state,
        currentUser: capturePayload(action.payload)
      }

    case FETCH_FOR_GROUP: {
      const slug = action.meta?.slug
      if (!slug) return state

      return {
        ...state,
        groupsBySlug: trimGroupsBySlug({
          ...state.groupsBySlug,
          [slug]: capturePayload(action.payload)
        })
      }
    }

    default:
      return state
  }
}
