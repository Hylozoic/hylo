/**
 * True when a stored return path carries group invite credentials (join link or email invite).
 * @param {string|null|undefined} returnToPath
 */
export function isInviteReturnPath (returnToPath) {
  if (!returnToPath) return false
  try {
    const url = new URL(returnToPath, 'https://hylo.com')
    return url.searchParams.has('accessCode') || url.searchParams.has('token')
  } catch {
    return false
  }
}

/**
 * Whether the current location matches the stored return destination (path + query).
 * @param {{ pathname: string, search: string }} location
 * @param {string} returnToPath
 */
export function isAtReturnToPath (location, returnToPath) {
  if (!returnToPath) return false
  try {
    const dest = new URL(returnToPath, 'https://hylo.com')
    return location.pathname === dest.pathname && location.search === dest.search
  } catch {
    return false
  }
}

/**
 * A /login or /signup link that brings the person back to `returnToPath` afterwards
 * (NonAuthLayoutRouter stores the returnToUrl param as the returnToPath).
 * @param {string} authPath - '/login' or '/signup'
 * @param {string|null|undefined} returnToPath - path + query to come back to
 */
export function authPathWithReturnTo (authPath, returnToPath) {
  if (!returnToPath || returnToPath === '/') return authPath
  return `${authPath}?returnToUrl=${encodeURIComponent(returnToPath)}`
}
