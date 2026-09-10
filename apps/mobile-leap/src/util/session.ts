import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import CookieManager from '@preeternal/react-native-cookie-manager'
import { API_HOST, HYLO_WEB_BASE_URL, SESSION_COOKIE_KEY } from 'config'
import apiHost from 'util/apiHost'
import { getTokens, refreshAndSaveTokens } from 'util/tokenStore'
import { authLog, maskToken, AUTH_DEBUG } from 'util/authDebug'

const COOKIE_ATTRS = ['HttpOnly', 'Expires', 'Max-Age', 'Domain', 'Path', 'Version']

// WKWebView on iOS needs useWebKit=true to target the WebKit cookie store.
const USE_WEBKIT = Platform.OS === 'ios'

export async function setSessionCookie (resp: Response) {
  const header = resp.headers.get('set-cookie')
  if (!header) return

  const newCookies = parseCookies(header)
  const str = await getSessionCookie()
  const oldCookies = parseCookies(str ?? '')
  const merged = omitInvalidPairs({ ...oldCookies, ...newCookies })
  const cookie = serializeCookie(merged)
  await AsyncStorage.setItem(SESSION_COOKIE_KEY, cookie)
  authLog('session.setSessionCookie: persisted cookie')

  syncCookiesToWebView(merged).catch(err =>
    console.warn('Failed to sync cookies to WebView cookie jar:', err)
  )

  return cookie
}

export async function getSessionCookie () {
  return AsyncStorage.getItem(SESSION_COOKIE_KEY)
}

export async function clearSessionCookie () {
  await AsyncStorage.removeItem(SESSION_COOKIE_KEY)
  await CookieManager.clearAll(USE_WEBKIT).catch(err =>
    console.warn('Failed to clear WebView cookie jar:', err)
  )
}

// Populate the WebView cookie jar from AsyncStorage before the WebView loads.
export async function ensureWebViewCookies () {
  const cookieStr = await getSessionCookie()
  if (!cookieStr) return
  const cookieObj = omitInvalidPairs(parseCookies(cookieStr))
  await syncCookiesToWebView(cookieObj).catch(err =>
    console.warn('Failed to pre-populate WebView cookie jar:', err)
  )
  await logCookieJar('after ensureWebViewCookies')
}

export async function logCookieJar (label: string) {
  if (!AUTH_DEBUG) return
  try {
    const webUrl = HYLO_WEB_BASE_URL
    const [apiJar, webJar] = await Promise.all([
      CookieManager.get(apiHost, USE_WEBKIT),
      CookieManager.get(webUrl, USE_WEBKIT)
    ])
    const describe = (jar: Record<string, { name?: string, domain?: string, path?: string, value?: string }> | null) =>
      Object.values(jar || {})
        .map(c => `${c.name}@${c.domain || '?'}${c.path || ''}=${maskToken(c.value)}`)
        .join(', ') || 'none'
    authLog(`cookie jar [${label}] ${apiHost} → ${describe(apiJar)} || ${webUrl} → ${describe(webJar)}`)
  } catch (e) {
    authLog(`cookie jar [${label}] read failed: ${(e as Error).message}`)
  }
}

async function postSessionFromToken (accessToken: string) {
  return fetch(`${API_HOST}/noo/session/from-token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  })
}

// Exchange native bearer token for a WebView session cookie.
export async function sessionCookieFromToken () {
  let tokens = await getTokens()
  if (!tokens?.access_token) return null

  try {
    let resp = await postSessionFromToken(tokens.access_token)

    if (resp.status === 401 && tokens.refresh_token) {
      tokens = await refreshAndSaveTokens()
      resp = await postSessionFromToken(tokens.access_token)
    }

    if (!resp.ok) return null

    await setSessionCookie(resp)
    await logCookieJar('after from-token sync')
    return getSessionCookie()
  } catch (err) {
    console.warn('Failed to derive WebView session from token:', err)
    return null
  }
}

function cookieDomainForUrl (url: string) {
  const noScheme = String(url).replace(/^[a-z]+:\/\//i, '')
  const host = noScheme.split('/')[0].split(':')[0]
  if (!host || host === 'localhost' || /^[0-9.]+$/.test(host)) return undefined
  const labels = host.split('.')
  if (labels.length < 2) return undefined
  return '.' + labels.slice(-2).join('.')
}

async function syncCookiesToWebView (cookieObj: Record<string, string>) {
  const url = HYLO_WEB_BASE_URL
  if (!url || !cookieObj) return

  const domain = cookieDomainForUrl(url)
  const secure = /^https:/i.test(url)

  await Promise.all(
    Object.entries(cookieObj).map(([name, value]) =>
      CookieManager.set(
        url,
        { name, value, path: '/', secure, ...(domain ? { domain } : {}) },
        USE_WEBKIT
      )
    )
  )
}

export function parseCookies (cookieStr: string) {
  if (!cookieStr) return {}
  return cookieStr.split(';').reduce<Record<string, string>>((m, n) => {
    const splits = n.trim().split('=')
    const key = splits[0]
    const value = splits[1]

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

export function serializeCookie (cookieObj: Record<string, string>) {
  return Object.entries(cookieObj).reduce<string | null>((m, [k, v]) => {
    if (k == null || v == null || v === 'undefined') return m
    const segment = encodeURIComponent(k) + '=' + encodeURIComponent(v)
    return m ? m + '; ' + segment : segment
  }, null) ?? ''
}

function omitInvalidPairs (obj: Record<string, string>) {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!invalidPair(v, k)) result[k] = v
  }
  return result
}

function invalidPair (v: string, k: string) {
  return k == null || v === 'undefined' || COOKIE_ATTRS.includes(k)
}

export async function clearAllExceptSessionCookie () {
  try {
    const cookie = await AsyncStorage.getItem(SESSION_COOKIE_KEY)
    await AsyncStorage.clear()
    if (cookie) await AsyncStorage.setItem(SESSION_COOKIE_KEY, cookie)
  } catch (error) {
    console.warn('Failed to clear cache before restart:', error)
  }
}
