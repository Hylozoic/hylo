import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import Config from 'react-native-config'
import CookieManager from '@react-native-cookies/cookies'
import { isNull, isUndefined, omitBy, reduce } from 'lodash'
import apiHost from 'util/apiHost'
import { getTokens, refreshAndSaveTokens } from 'util/tokenStore'

const COOKIE_KEY = Config.SESSION_COOKIE_KEY || 'hylo_session_cookie'

// WKWebView on iOS needs useWebKit=true to target the WebKit cookie store.
// Android WebView uses the system CookieManager (useWebKit=false).
const USE_WEBKIT = Platform.OS === 'ios'

export async function setSessionCookie (resp) {
  const header = resp.headers.get('set-cookie')

  if (!header) return Promise.resolve()

  const newCookies = parseCookies(header)
  const str = await getSessionCookie()
  const oldCookies = parseCookies(str)
  const merged = omitBy({ ...oldCookies, ...newCookies }, invalidPair)
  const cookie = serializeCookie(merged)
  await AsyncStorage.setItem(COOKIE_KEY, cookie)

  // Mirror into the WebView's native cookie jar so in-WebView requests (fetch/XHR
  // after initial page load) use the same session as the native GraphQL client.
  syncCookiesToWebView(merged).catch(err =>
    console.warn('Failed to sync cookies to WebView cookie jar:', err)
  )

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
}

async function postSessionFromToken (accessToken) {
  return fetch(`${apiHost}/noo/session/from-token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  })
}

/**
 * Token-auth WebView handoff: exchanges the native access token for a server
 * session cookie (via POST /noo/session/from-token), persists it, and mirrors it
 * into the WebView's cookie jar so the web app loads authenticated with no login
 * flash. Returns the cookie string, or null when there's no token or the
 * exchange fails (the caller then falls back to any existing cookie).
 *
 * Retries once after a transparent refresh if the access token has expired.
 */
export async function sessionCookieFromToken () {
  let tokens = await getTokens()
  if (!tokens?.access_token) return null

  try {
    let resp = await postSessionFromToken(tokens.access_token)

    if (resp.status === 401 && tokens.refresh_token) {
      // Shared single-flight refresh (see tokenStore.refreshAndSaveTokens): avoids
      // racing the urql authExchange and spending the rotating refresh token twice.
      tokens = await refreshAndSaveTokens()
      resp = await postSessionFromToken(tokens.access_token)
    }

    if (!resp.ok) return null

    await setSessionCookie(resp)
    return getSessionCookie()
  } catch (err) {
    console.warn('Failed to derive WebView session from token:', err)
    return null
  }
}

/**
 * Writes each key-value pair from a parsed cookie object into the WebView's native
 * cookie store. Called after every setSessionCookie to keep the AsyncStorage cookie
 * and the WebView's jar in sync.
 *
 * The cookie is set for BOTH the web origin (HYLO_WEB_BASE_URL, used for page
 * navigation) and the API origin (apiHost, used by in-WebView fetch/XHR to
 * /noo/graphql). On iOS the WKWebView cookie store is host-scoped, so a cookie set
 * only for the web origin is NOT sent to the API origin — after a cold resume the web
 * app's GraphQL calls then arrive unauthenticated, the RootRouter sees no session, and
 * (previously) the app was logged out. Setting it for apiHost too keeps the WebView's
 * GraphQL requests authenticated from the bridged token session.
 */
async function syncCookiesToWebView (cookieObj) {
  const urls = [Config.HYLO_WEB_BASE_URL, apiHost].filter(Boolean)
  if (urls.length === 0 || !cookieObj) return

  await Promise.all(
    urls.flatMap(url =>
      Object.entries(cookieObj).map(([name, value]) =>
        CookieManager.set(url, { name, value, path: '/' }, USE_WEBKIT)
      )
    )
  )
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
