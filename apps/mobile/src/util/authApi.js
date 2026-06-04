import apiHost from 'util/apiHost'

// First-party native auth API. These hit the backend endpoints added in the
// Phase 1 backend slice:
//   POST /noo/login/native            → mint a token pair from email/password
//   POST /noo/oauth/token             → refresh (standard oidc-provider endpoint)
//   POST /noo/oauth/token/revocation  → revoke on logout
export const NATIVE_CLIENT_ID = 'hylo-mobile'

// Note: the absolute `expires_at` used for proactive refresh is stamped by
// tokenStore.saveTokens, so every issuance path (native, social, refresh) is
// consistent. These helpers just return the raw token response.
export async function nativeLogin (email, password) {
  const res = await fetch(`${apiHost}/noo/login/native`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function refreshTokens (refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: NATIVE_CLIENT_ID,
    refresh_token: refreshToken
  })
  const res = await fetch(`${apiHost}/noo/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  if (!res.ok) throw new Error('token refresh failed')
  return res.json()
}

export async function revokeToken (token) {
  const body = new URLSearchParams({ token, client_id: NATIVE_CLIENT_ID })
  await fetch(`${apiHost}/noo/oauth/token/revocation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  }).catch(() => {})
}
