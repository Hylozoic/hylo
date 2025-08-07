import { isNull, isUndefined, omitBy, reduce } from 'lodash'

/**
 * Shared session utility that works across different environments
 * Supports web (localStorage), mobile (AsyncStorage), and Expo (AsyncStorage)
 */

let storage
let sessionCookieKey

// Try different storage mechanisms
if (typeof window !== 'undefined' && window.localStorage) {
  // Web environment
  storage = {
    getItem: (key) => Promise.resolve(window.localStorage.getItem(key)),
    setItem: (key, value) => Promise.resolve(window.localStorage.setItem(key, value)),
    removeItem: (key) => Promise.resolve(window.localStorage.removeItem(key))
  }
  sessionCookieKey = 'hylo_session_cookie'
} else {
  // React Native environment
  try {
    storage = require('@react-native-async-storage/async-storage').default
    // Try to get session cookie key from environment
    if (typeof process !== 'undefined' && process.env && process.env.SESSION_COOKIE_KEY) {
      sessionCookieKey = process.env.SESSION_COOKIE_KEY
    } else if (typeof global !== 'undefined' && global.Expo) {
      try {
        const Constants = require('expo-constants')
        sessionCookieKey = Constants.expoConfig?.extra?.sessionCookieKey || 'hylo_session_cookie'
      } catch (e) {
        sessionCookieKey = 'hylo_session_cookie'
      }
    } else {
      sessionCookieKey = 'hylo_session_cookie'
    }
  } catch (e) {
    // Fallback storage
    storage = {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve()
    }
    sessionCookieKey = 'hylo_session_cookie'
  }
}

export async function setSessionCookie (resp) {
  const header = resp.headers.get('set-cookie')

  if (!header) return Promise.resolve()

  const newCookies = parseCookies(header)
  const str = await getSessionCookie()
  const oldCookies = parseCookies(str)
  const merged = omitBy({ ...oldCookies, ...newCookies }, invalidPair)
  const cookie = serializeCookie(merged)
  await storage.setItem(sessionCookieKey, cookie)

  return cookie
}

export async function getSessionCookie () {
  return storage.getItem(sessionCookieKey)
}

export async function clearSessionCookie () {
  return storage.removeItem(sessionCookieKey)
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