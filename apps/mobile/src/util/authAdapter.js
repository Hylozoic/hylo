import { nativeLogin, revokeToken } from 'util/authApi'
import { saveTokens, getTokens, clearTokens } from 'util/tokenStore'

// Mobile login mechanism injected into the shared <AuthProvider>. Web/desktop
// keep the cookie-session login (the GraphQL `login`/`logout` mutations); mobile
// uses a Bearer token pair stored in the Keychain. See AuthContext for how this
// is wired in alongside the server-session teardown on logout.
export const mobileAuthAdapter = {
  async login ({ email, password }) {
    const tokens = await nativeLogin(email, password)
    await saveTokens(tokens)
  },
  async logout () {
    const tokens = await getTokens()
    if (tokens?.refresh_token) await revokeToken(tokens.refresh_token)
    await clearTokens()
  }
}
