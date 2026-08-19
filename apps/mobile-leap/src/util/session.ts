import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import CookieManager from '@preeternal/react-native-cookie-manager'
import { HYLO_WEB_BASE_URL, SESSION_COOKIE_KEY } from 'config'
import apiHost from 'util/apiHost'
import { getTokens, refreshAndSaveTokens } from 'util/tokenStore'
import { authLog, maskToken, AUTH_DEBUG, authHandshakeEvent } from 'util/authDebug'

const COOKIE_ATTRS = ['HttpOnly', 'Expires', 'Max-Age', 'Domain', 'Path', 'Version']

// WKWebView on iOS needs useWebKit=true to target the WebKit cookie store.
const USE_WEBKIT = Platform.OS === 'ios'

type CookieJarEntry = { name?: string, domain?: string, path?: string, value?: string }

/** Avoid `https://host.com//app` when the base URL has a trailing slash. */
export function joinWebBaseAndPath (base: string, path: string) {
  const b = String(base || '').replace(/\/+$/, '')
  let p = String(path || '')
  if (!p || p === '/') return `${b}/`
  if (/^https?:\/\//i.test(p)) return p
  p = p.replace(/^\/+/, '/').replace(/\/{2,}/g, '/')
  if (!p.startsWith('/')) p = `/${p}`
  return b + p
}

/** Normalizes mobile deep-link paths (e.g. `//app` → `/app`). */
export function normalizeWebPath (path: string | undefined | null) {
  if (!path) return '/app'
  let p = String(path).trim()
  if (!p.startsWith('/')) p = `/${p}`
  p = p.replace(/\/{2,}/g, '/')
  return p || '/app'
}

function normalizeWebBaseUrl (url: string) {
  return String(url || '').replace(/\/+$/, '')
}

export async function setSessionCookie (resp: Response) {
  const header = resp.headers.get('set-cookie')
  if (!header) return null

  const newCookies = parseCookies(header)
  const str = await getSessionCookie()
  const oldCookies = parseCookies(str ?? '')
  const merged = omitInvalidPairs({ ...oldCookies, ...newCookies })
  const cookie = serializeCookie(merged)
  await AsyncStorage.setItem(SESSION_COOKIE_KEY, cookie)
  authLog('session.setSessionCookie: persisted cookie')
  await syncCookiesToWebView(merged)
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
    const describe = (jar: Record<string, CookieJarEntry> | null) =>
      Object.values(jar || {})
        .map(c => `${c.name}@${c.domain || '?'}${c.path || ''}=${maskToken(c.value)}`)
        .join(', ') || 'none'
    authLog(`cookie jar [${label}] ${apiHost} → ${describe(apiJar)} || ${webUrl} → ${describe(webJar)}`)
  } catch (e) {
    authLog(`cookie jar [${label}] read failed: ${(e as Error).message}`)
  }
}

/**
 * Where native code mints a browser session from the Keychain access token.
 * Review/Heroku frontends (*.herokuapp.com) must use same-origin /noo on the web
 * host so Set-Cookie is rewritten for host-only cookies; direct api-staging calls
 * return Domain=.hylo.com which the WebView jar rejects on non-hylo pages.
 */
export function sessionFromTokenUrl () {
  const web = String(HYLO_WEB_BASE_URL || '').replace(/\/$/, '')
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

async function postSessionFromToken (accessToken: string) {
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

async function persistSessionCookiesFromJar (webBaseUrl: string) {
  const jar = await CookieManager.get(webBaseUrl, USE_WEBKIT)
  const cookieObj = omitInvalidPairs(
    Object.values(jar || {}).reduce<Record<string, string>>((m, c) => {
      if (c?.name && c?.value) m[c.name] = c.value
      return m
    }, {})
  )
  if (!Object.keys(cookieObj).length) return null

  const cookie = serializeCookie(cookieObj)
  await AsyncStorage.setItem(SESSION_COOKIE_KEY, cookie)
  await syncCookiesToWebView(cookieObj)
  return cookie
}

/**
 * RN fetch often hides Set-Cookie from JS. Push the header into the WebKit/Android
 * jar when present, then read the jar for the review/staging web host.
 */
async function ingestSessionFromTokenResponse (requestUrl: string, resp: Response) {
  const setCookie = resp.headers.get('set-cookie')
  if (setCookie) {
    try {
      const cookieManager = CookieManager as typeof CookieManager & {
        setFromResponse?: (url: string, header: string) => Promise<unknown>
      }
      await cookieManager.setFromResponse?.(requestUrl, setCookie)
    } catch (e) {
      authLog('setFromResponse failed:', (e as Error)?.message || e)
    }
  }

  await setSessionCookie(resp)

  const webBase = normalizeWebBaseUrl(HYLO_WEB_BASE_URL)
  const fromJar = webBase ? await persistSessionCookiesFromJar(webBase) : null
  const stored = fromJar || await getSessionCookie()

  authHandshakeEvent('session/from-token cookie ingest', {
    hadSetCookieHeader: !!setCookie,
    storedCookieNames: stored
      ? Object.keys(omitInvalidPairs(parseCookies(stored))).join(',') || 'none'
      : 'none'
  }, stored ? 'info' : 'warning')

  return stored
}

// Exchange native bearer token for a WebView session cookie.
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
    authHandshakeEvent('session/from-token error', { message: (err as Error)?.message || String(err) }, 'warning')
    return null
  }
}

function cookieDomainForUrl (url: string) {
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

async function syncCookiesToWebView (cookieObj: Record<string, string>) {
  if (!cookieObj) return

  const web = HYLO_WEB_BASE_URL
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

/** WebView originWhitelist including the configured web host (review apps, custom URLs). */
export function webViewOriginWhitelist (webBaseUrl: string) {
  const list = [
    'https://www.hylo*',
    'https://staging.hylo*',
    'http://localhost*',
    'https://www.youtube.com',
    'https://*.youtube.com',
    'https://*.vimeo.com',
    'https://*.soundcloud.com'
  ]
  try {
    const origin = new URL(webBaseUrl).origin
    if (origin) list.push(`${origin}*`)
  } catch (e) { /* ignore invalid base URL */ }
  return list
}
