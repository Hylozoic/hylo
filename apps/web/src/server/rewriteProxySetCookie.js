/**
 * Staging/production API Set-Cookie uses Domain=.hylo.com. Browsers reject that when the
 * page is served from a Heroku review app (*.herokuapp.com). Strip Domain so the session
 * is stored as a host-only cookie for the review frontend; /noo proxy forwards it upstream.
 */
export function shouldRewriteProxySetCookie (frontendHostname) {
  if (!frontendHostname) return false
  if (frontendHostname === 'localhost') return false
  if (frontendHostname.endsWith('hylo.com')) return false
  return true
}

export function rewriteSetCookieForFrontendHost (setCookieHeader, frontendHostname) {
  if (!setCookieHeader || !shouldRewriteProxySetCookie(frontendHostname)) {
    return setCookieHeader
  }
  return setCookieHeader.replace(/;\s*Domain=[^;]*/gi, '')
}

export function rewriteSetCookieHeaders (headers, frontendHostname) {
  if (!headers['set-cookie']) return headers
  const raw = headers['set-cookie']
  const cookies = Array.isArray(raw) ? raw : [raw]
  return {
    ...headers,
    'set-cookie': cookies.map(c => rewriteSetCookieForFrontendHost(c, frontendHostname))
  }
}
