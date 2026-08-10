export const CREATE_GROUP_PARAM = 'createGroup'

// Opening create-group is a query param on whatever page you're already on, so the
// modal layers over the current view instead of navigating away from it.
export function createGroupModalUrl (location, params = {}) {
  const search = new URLSearchParams(location?.search || '')
  search.set(CREATE_GROUP_PARAM, 'true')
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  return `${location?.pathname || '/'}?${search.toString()}`
}
