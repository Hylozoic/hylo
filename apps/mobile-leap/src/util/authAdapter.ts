import { nativeLogin, revokeToken } from 'util/authApi'
import { saveTokens, getTokens, clearTokens } from 'util/tokenStore'

export const mobileAuthAdapter = {
  async login ({ email, password }: { email: string, password: string }) {
    const tokens = await nativeLogin(email, password)
    await saveTokens(tokens)
  },
  async logout () {
    const tokens = await getTokens()
    if (tokens?.refresh_token) await revokeToken(tokens.refresh_token)
    await clearTokens()
  }
}
