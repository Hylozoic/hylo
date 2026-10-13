import * as Keychain from 'react-native-keychain'
import { refreshTokens } from 'util/authApi'
import { authLog, maskToken } from 'util/authDebug'

// Secure, native credential store for the OAuth/OIDC token pair minted by the
// backend (`/noo/login/native`, social verify endpoints, `/noo/oauth/token`).
// This replaces the AsyncStorage session cookie as the source of truth for
// native auth. The WebView session is derived from these tokens (bridge slice).
const SERVICE = 'hylo.tokens'

// In-memory mirror of the persisted tokens. The urql authExchange reads this
// synchronously per-operation so a freshly-saved token is attached immediately
// (without it, the exchange would keep using the value loaded at app start).
let cachedTokens = null

// Loads tokens from the Keychain into the in-memory cache (call once at startup).
export async function loadTokens () {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE })
    cachedTokens = creds ? JSON.parse(creds.password) : null
    authLog('tokenStore.loadTokens:', cachedTokens
      ? `found access=${maskToken(cachedTokens.access_token)} refresh=${maskToken(cachedTokens.refresh_token)} expiresAt=${cachedTokens.expires_at ? new Date(cachedTokens.expires_at).toISOString() : 'n/a'}`
      : 'no tokens in Keychain')
  } catch (err) {
    authLog('tokenStore.loadTokens FAILED:', err?.message)
    cachedTokens = null
  }
  return cachedTokens
}

// Synchronous accessor for the cached tokens (used by the urql authExchange).
export function getCachedTokens () {
  return cachedTokens
}

// Returns the tokens, preferring the in-memory cache and falling back to the Keychain.
export async function getTokens () {
  if (cachedTokens) return cachedTokens
  return loadTokens()
}

// Persists a token pair, always (re)computing an absolute `expires_at` from
// `expires_in` so the authExchange can refresh proactively. Centralising it here
// keeps every issuance path (native login, social, refresh) consistent and
// avoids a stale expiry surviving a refresh via object spread.
export async function saveTokens (tokens) {
  const expiresIn = Number(tokens?.expires_in) || 3600
  const stamped = { ...tokens, expires_at: Date.now() + expiresIn * 1000 }
  cachedTokens = stamped
  await Keychain.setGenericPassword('tokens', JSON.stringify(stamped), { service: SERVICE })
  authLog('tokenStore.saveTokens: saved access=' + maskToken(stamped.access_token) + ' refresh=' + maskToken(stamped.refresh_token))
  return stamped
}

export async function clearTokens () {
  cachedTokens = null
  await Keychain.resetGenericPassword({ service: SERVICE })
}

// Shared in-flight refresh promise. Multiple subsystems try to refresh on app
// reopen (the urql authExchange for GraphQL + the WebView session bridge), and
// each was independently POSTing the stored refresh token. Because the
// `hylo-mobile` OIDC client is public, oidc-provider ROTATES refresh tokens:
// the first refresh consumes the token, and a second use of the now-consumed
// token makes the provider revoke the whole grant — silently logging the user
// out on reopen. Funnelling every caller through one promise guarantees the
// refresh token is spent exactly once per rotation and everyone gets the new pair.
let refreshPromise = null

// Refreshes the access/refresh token pair (single-flight) and persists the
// rotated result. Concurrent callers share the same in-flight request.
export async function refreshAndSaveTokens () {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const tokens = cachedTokens || await loadTokens()
    if (!tokens?.refresh_token) throw new Error('No refresh token to refresh')
    const refreshed = await refreshTokens(tokens.refresh_token)
    return saveTokens({ ...tokens, ...refreshed })
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}
