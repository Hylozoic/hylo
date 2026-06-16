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
