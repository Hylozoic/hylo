import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import Config from 'react-native-config'
import CookieManager from '@react-native-cookies/cookies'
import { isNull, isUndefined, omitBy, reduce } from 'lodash'
import apiHost from 'util/apiHost'
import { getTokens, refreshAndSaveTokens } from 'util/tokenStore'
import { authLog, maskToken, AUTH_DEBUG, authHandshakeEvent } from 'util/authDebug'

const COOKIE_KEY = Config.SESSION_COOKIE_KEY || 'hylo_session_cookie'

// WKWebView on iOS needs useWebKit=true to target the WebKit cookie store.
// Android WebView uses the system CookieManager (useWebKit=false).
const USE_WEBKIT = Platform.OS === 'ios'

/** Avoid `https://host.com//app` when the base URL has a trailing slash. */
export function joinWebBaseAndPath (base, path) {
  const b = String(base || '').replace(/\/+$/, '')
  let p = String(path || '')
  if (!p || p === '/') return `${b}/`
  if (/^https?:\/\//i.test(p)) return p
  p = p.replace(/^\/+/, '/').replace(/\/{2,}/g, '/')
  if (!p.startsWith('/')) p = `/${p}`
  return b + p
}

/** Normalizes mobile deep-link paths (e.g. `//app` → `/app`). */
export function normalizeWebPath (path) {
  if (!path) return '/app'
  let p = String(path).trim()
  if (!p.startsWith('/')) p = `/${p}`
  p = p.replace(/\/{2,}/g, '/')
  return p || '/app'
}

function normalizeWebBaseUrl (url) {
  return String(url || '').replace(/\/+$/, '')
}

export async function setSessionCookie (resp) {
  const header = resp.headers.get('set-cookie')

  if (!header) return null

  const newCookies = parseCookies(header)
  const str = await getSessionCookie()
  const oldCookies = parseCookies(str)
  const merged = omitBy({ ...oldCookies, ...newCookies }, invalidPair)
  const cookie = serializeCookie(merged)
  await AsyncStorage.setItem(COOKIE_KEY, cookie)
  await syncCookiesToWebView(merged)
  return cookie
}

export async function getSessionCookie () {
  return AsyncStorage.getItem(COOKIE_KEY)
}

export async function clearSessionCookie () {
  await AsyncStorage.removeItem(COOKIE_KEY)
  // Also invalidate the WebView's cookie jar so the session is fully cleared on logout.
  await CookieManager.clearAll(USE_WEBKIT).catch(err =>
    console.warn('Failed to clear WebView cookie jar:', err)
  )
}

/**
 * Reads the current session cookie from AsyncStorage and writes it into the WebView's
 * native cookie jar. Call this before the WebView loads (e.g. in useFocusEffect).
 *
 * Why this is needed on Android: sharedCookiesEnabled is iOS-only. On Android the
 * WebView's CookieManager is completely separate from the native HTTP stack. If the
 * server doesn't send Set-Cookie on the current request (valid session, no refresh),
 * syncCookiesToWebView never runs and the jar stays empty. In-WebView XHR calls then
 * fail auth, causing the web app to redirect and the page to visually "restart".
 */
export async function ensureWebViewCookies () {
  const cookieStr = await getSessionCookie()
  if (!cookieStr) return
  const cookieObj = omitBy(parseCookies(cookieStr), invalidPair)
  await syncCookiesToWebView(cookieObj).catch(err =>
    console.warn('Failed to pre-populate WebView cookie jar:', err)
  )
  await logCookieJar('after ensureWebViewCookies')
}

/**
 * Diagnostic: dumps the cookies the WebView/native HTTP stacks actually hold for
 * the API host and the web host, so we can see WHICH cookie is sent to api-*.hylo.com
 * (the one the WebView's CheckLogin resolves) and whether it's correctly scoped. The
 * API-host jar is the decisive one — that's where the WebView's GraphQL requests go.
 * Staging-visible (AUTH_DEBUG); no-op otherwise.
 */
export async function logCookieJar (label) {
  if (!AUTH_DEBUG) return
  try {
    const webUrl = Config.HYLO_WEB_BASE_URL
    const [apiJar, webJar] = await Promise.all([
      CookieManager.get(apiHost, USE_WEBKIT),
      CookieManager.get(webUrl, USE_WEBKIT)
    ])
    const describe = jar => Object.values(jar || {})
      .map(c => `${c.name}@${c.domain || '?'}${c.path || ''}=${maskToken(c.value)}`)
      .join(', ') || 'none'
    authLog(`cookie jar [${label}] ${apiHost} → ${describe(apiJar)} || ${webUrl} → ${describe(webJar)}`)
  } catch (e) {
    authLog(`cookie jar [${label}] read failed: ${e.message}`)
  }
}

/**
 * Where native code mints a browser session from the Keychain access token.
 * Review/Heroku frontends (*.herokuapp.com) must use same-origin /noo on the web
 * host so Set-Cookie is rewritten for host-only cookies; direct api-staging calls
 * return Domain=.hylo.com which the WebView jar rejects on non-hylo pages.
 */
export function sessionFromTokenUrl () {
  const web = String(Config.HYLO_WEB_BASE_URL || '').replace(/\/$/, '')
  if (web) {
    try {
      const { hostname } = new URL(web)
      if (
        hostname !== 'localhost' &&
        !/^[0-9.]+$/.test(hostname) &&
        !hostname.endsWith('hylo.com')
      ) {
        return `${web}/noo/session/from-token`
      }
    } catch (e) { /* use API host below */ }
  }
  return `${apiHost}/noo/session/from-token`
}

async function postSessionFromToken (accessToken) {
  const url = sessionFromTokenUrl()
  authLog('session/from-token POST', url)
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  })
  return { resp, url }
}

async function persistSessionCookiesFromJar (webBaseUrl) {
  const jar = await CookieManager.get(webBaseUrl, USE_WEBKIT)
  const cookieObj = omitBy(
    Object.values(jar || {}).reduce((m, c) => {
      if (c?.name && c?.value) m[c.name] = c.value
      return m
    }, {}),
    invalidPair
  )
  if (!Object.keys(cookieObj).length) return null

  const cookie = serializeCookie(cookieObj)
  await AsyncStorage.setItem(COOKIE_KEY, cookie)
  await syncCookiesToWebView(cookieObj)
  return cookie
}

/**
 * RN fetch often hides Set-Cookie from JS. Push the header into the WebKit/Android
 * jar when present, then read the jar for the review/staging web host.
 */
async function ingestSessionFromTokenResponse (requestUrl, resp) {
  const setCookie = resp.headers.get('set-cookie')
  if (setCookie) {
    try {
      await CookieManager.setFromResponse(requestUrl, setCookie)
    } catch (e) {
      authLog('setFromResponse failed:', e?.message || e)
    }
  }

  await setSessionCookie(resp)

  const webBase = normalizeWebBaseUrl(Config.HYLO_WEB_BASE_URL)
  const fromJar = webBase ? await persistSessionCookiesFromJar(webBase) : null
  const stored = fromJar || await getSessionCookie()

  authHandshakeEvent('session/from-token cookie ingest', {
    hadSetCookieHeader: !!setCookie,
    storedCookieNames: stored
      ? Object.keys(omitBy(parseCookies(stored), invalidPair)).join(',') || 'none'
      : 'none'
  }, stored ? 'info' : 'warning')

  return stored
}

/**
 * Token-auth WebView handoff: exchanges the native access token for a server
 * session cookie (via POST /noo/session/from-token), persists it, and mirrors it
 * into the WebView's cookie jar. Returns the cookie string, or null on failure.
 *
 * Retries once after a transparent refresh if the access token has expired.
 */
export async function sessionCookieFromToken () {
  let tokens = await getTokens()
  if (!tokens?.access_token) return null

  try {
    let { resp, url } = await postSessionFromToken(tokens.access_token)

    if (resp.status === 401 && tokens.refresh_token) {
      tokens = await refreshAndSaveTokens()
      ;({ resp, url } = await postSessionFromToken(tokens.access_token))
    }

    if (!resp.ok) {
      const tokenUrl = sessionFromTokenUrl()
      authLog('session/from-token failed', `${resp.status} ${tokenUrl}`)
      let host = ''
      try {
        host = new URL(tokenUrl).host
      } catch (e) { /* ignore */ }
      authHandshakeEvent('session/from-token failed', { status: resp.status, host }, 'warning')
      return null
    }

    let host = ''
    try {
      host = new URL(url).host
    } catch (e) { /* ignore */ }
    authHandshakeEvent('session/from-token ok', { status: resp.status, host })

    const cookie = await ingestSessionFromTokenResponse(url, resp)
    await logCookieJar('after from-token sync')
    return cookie
  } catch (err) {
    console.warn('Failed to derive WebView session from token:', err)
    authHandshakeEvent('session/from-token error', { message: err?.message || String(err) }, 'warning')
    return null
  }
}

/**
 * Derives the registrable cookie domain (e.g. `.hylo.com`) from a base URL so the
 * mirrored session cookie is sent across sibling subdomains.
 *
 * This is the crux of the iOS social-login logout bug: the web app is served from
 * HYLO_WEB_BASE_URL (e.g. staging.hylo.com) but its GraphQL/auth requests go to
 * API_HOST (e.g. api-staging.hylo.com). A cookie set without a Domain is host-only
 * for staging.hylo.com and is never sent to api-staging.hylo.com — so the WebView's
 * own auth check (CheckLogin) falls back to a stale anonymous cookie and reports
 * itself logged out. Scoping the cookie to `.hylo.com` lets it reach the API host
 * and overrides that stale cookie. Returns undefined for localhost/IPs (host-only
 * is correct there, which is why this never reproduced on local dev).
 */
function cookieDomainForUrl (url) {
  const noScheme = String(url).replace(/^[a-z]+:\/\//i, '')
  const host = noScheme.split('/')[0].split(':')[0]
  if (!host || host === 'localhost' || /^[0-9.]+$/.test(host)) return undefined
  // Only widen scope for hylo.com hosts. Review frontends (e.g. *.herokuapp.com) sit on
  // public-suffix domains where Domain= cookies are rejected by the WebView cookie store
  // (supercookie protection), silently breaking the session sync — host-only is correct there.
  if (!host.endsWith('hylo.com')) return undefined
  const labels = host.split('.')
  if (labels.length < 2) return undefined
  return '.' + labels.slice(-2).join('.')
}

/**
 * Writes each key-value pair from a parsed cookie object into the WebView's native
 * cookie store for both the web host and the API host. Called after every
 * setSessionCookie to keep the AsyncStorage cookie and the WebView's jar in sync.
 */
async function syncCookiesToWebView (cookieObj) {
  if (!cookieObj) return

  const web = Config.HYLO_WEB_BASE_URL
  const urls = web ? [web] : []
  // Review/Heroku web hosts only talk to same-origin /noo/graphql — do not mirror
  // session cookies onto api-staging with Domain=.hylo.com (jar rejects or ignores).
  if (web && cookieDomainForUrl(web)) {
    urls.push(apiHost)
  } else if (!web && apiHost) {
    urls.push(apiHost)
  }

  const uniqueUrls = [...new Set(urls.filter(Boolean))]

  await Promise.all(uniqueUrls.map(url => {
    const domain = cookieDomainForUrl(url)
    const secure = /^https:/i.test(url)

    return Promise.all(
      Object.entries(cookieObj).map(([name, value]) =>
        CookieManager.set(
          url,
          { name, value, path: '/', secure, ...(domain ? { domain } : {}) },
          USE_WEBKIT
        )
      )
    )
  }))
}

// this is a bag of hacks that probably only works with our current backend.
// we have to handle three cases: one in which we get a 'hylo.sid.1' cookie from
// Sails, one in which we get a 'heroku-session-affinity' cookie from heroku,
// and one in which we get both at once, comma-delimited.
//
// but parsing the third case is not simply a matter of splitting by a comma,
// because a comma can also occur in the value for Expires in a cookie.
//
// see the tests for an example taken from the production server.
export function parseCookies (cookieStr) {
  if (!cookieStr) return {}
  return cookieStr.split(';').reduce((m, n) => {
    const splits = n.trim().split('=')
    const key = splits[0]
    const value = splits[1]

    // if value contains ', ' and the key is not Expires, then this pair is
    // actually two pairs, which should be parsed and handled separately
    if (value && value.includes(', ') && key !== 'Expires') {
      const [value1, key2] = value.split(', ')
      const value2 = splits[2]
      m[decodeURIComponent(key)] = decodeURIComponent(value1)
      m[decodeURIComponent(key2)] = decodeURIComponent(value2)
    } else {
      m[decodeURIComponent(key)] = decodeURIComponent(value)
    }

    return m
  }, {})
}

export function serializeCookie (cookieObj) {
  return reduce(cookieObj, (m, v, k) => {
    if (isUndefined(k) || isUndefined(v)) return m

    const segment = encodeURIComponent(k) + '=' + encodeURIComponent(v)
    return m ? m + '; ' + segment : segment
  }, null)
}

function invalidPair (v, k) {
  return isNull(k) || isUndefined(k) || v === 'undefined' ||
    ['HttpOnly', 'Expires', 'Max-Age', 'Domain', 'Path', 'Version'].includes(k)
}

// Clear all AsyncStorage keys except the session cookie
export async function clearAllExceptSessionCookie () {
  try {
    const cookie = await AsyncStorage.getItem(COOKIE_KEY)
    await AsyncStorage.clear()
    if (cookie) await AsyncStorage.setItem(COOKIE_KEY, cookie)
  } catch (error) {
    // Swallow to avoid secondary crash during recovery
    console.warn('Failed to clear cache before restart:', error)
  }
}
