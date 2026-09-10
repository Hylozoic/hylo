import apiHost from 'util/apiHost'

export const NATIVE_CLIENT_ID = 'hylo-mobile'

export const TOKEN_AUTH_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'X-Hylo-Token-Auth': '1'
}

export async function nativeLogin (email: string, password: string) {
  const res = await fetch(`${apiHost}/noo/login/native`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function refreshTokens (refreshToken: string) {
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
  if (!res.ok) {
    const error = new Error('token refresh failed') as Error & { status?: number }
    error.status = res.status
    throw error
  }
  return res.json()
}

export async function revokeToken (token: string) {
  const body = new URLSearchParams({ token, client_id: NATIVE_CLIENT_ID })
  await fetch(`${apiHost}/noo/oauth/token/revocation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  }).catch(() => {})
}

export async function loginWithApple (body: Record<string, unknown>) {
  const res = await fetch(`${apiHost}/noo/login/apple/oauth`, {
    method: 'POST',
    headers: TOKEN_AUTH_HEADERS,
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function loginWithGoogle (accessToken: string) {
  const res = await fetch(
    `${apiHost}/noo/login/google-token/oauth?access_token=${encodeURIComponent(accessToken)}`,
    { method: 'POST', headers: TOKEN_AUTH_HEADERS }
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function loginByJWT (jwt: string) {
  const res = await fetch(`${apiHost}/noo/login/jwt`, {
    method: 'POST',
    headers: {
      ...TOKEN_AUTH_HEADERS,
      Authorization: `Bearer ${jwt}`
    }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function loginByToken (userId: string, loginToken: string) {
  const res = await fetch(`${apiHost}/noo/login/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ u: userId, t: loginToken }).toString()
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
