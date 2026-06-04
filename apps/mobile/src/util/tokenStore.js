import * as Keychain from 'react-native-keychain'

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
  } catch (err) {
    console.warn('Failed to load tokens from Keychain:', err)
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
  return stamped
}

export async function clearTokens () {
  cachedTokens = null
  await Keychain.resetGenericPassword({ service: SERVICE })
}
