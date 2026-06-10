export const LOGIN_WITH_APPLE = 'LOGIN_WITH_APPLE'
export const LOGIN_WITH_GOOGLE = 'LOGIN_WITH_GOOGLE'

// Opt-in header tells the backend to return an OIDC token pair (for the native
// Keychain) instead of only establishing a session cookie. The server session
// is still created, so the WebView handoff keeps working either way.
const TOKEN_AUTH_HEADERS = { 'X-Hylo-Token-Auth': '1' }

export function loginWithApple (params) {
  return {
    type: LOGIN_WITH_APPLE,
    payload: {
      api: { method: 'post', path: '/noo/login/apple/oauth', params, headers: TOKEN_AUTH_HEADERS }
    }
  }
}

export function loginWithGoogle (accessToken) {
  return {
    type: LOGIN_WITH_GOOGLE,
    payload: {
      api: { method: 'post', path: `/noo/login/google-token/oauth?access_token=${accessToken}`, headers: TOKEN_AUTH_HEADERS }
    }
  }
}
