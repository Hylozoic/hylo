import * as SecureStore from 'expo-secure-store'
import { refreshTokens } from 'util/authApi'
import { authLog, maskToken } from 'util/authDebug'

const STORE_KEY = 'hylo.tokens'

type TokenPair = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  expires_at?: number
  [key: string]: unknown
}

let cachedTokens: TokenPair | null = null
let refreshPromise: Promise<TokenPair> | null = null

// Loads tokens from SecureStore into the in-memory cache (call once at startup).
export async function loadTokens () {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY)
    cachedTokens = raw ? JSON.parse(raw) : null
    authLog('tokenStore.loadTokens:', cachedTokens
      ? `found access=${maskToken(cachedTokens.access_token)} refresh=${maskToken(cachedTokens.refresh_token)} expiresAt=${cachedTokens.expires_at ? new Date(cachedTokens.expires_at).toISOString() : 'n/a'}`
      : 'no tokens in SecureStore')
  } catch (err) {
    authLog('tokenStore.loadTokens FAILED:', (err as Error)?.message)
    cachedTokens = null
  }
  return cachedTokens
}

export function getCachedTokens () {
  return cachedTokens
}

export async function getTokens () {
  if (cachedTokens) return cachedTokens
  return loadTokens()
}

export async function saveTokens (tokens: TokenPair) {
  const expiresIn = Number(tokens?.expires_in) || 3600
  const stamped = { ...tokens, expires_at: Date.now() + expiresIn * 1000 }
  cachedTokens = stamped
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(stamped))
  authLog('tokenStore.saveTokens: saved access=' + maskToken(stamped.access_token) + ' refresh=' + maskToken(stamped.refresh_token))
  return stamped
}

export async function clearTokens () {
  cachedTokens = null
  await SecureStore.deleteItemAsync(STORE_KEY)
}

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
