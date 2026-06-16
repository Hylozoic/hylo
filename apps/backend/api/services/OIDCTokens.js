// Mints OAuth tokens for first-party native clients (e.g. the Hylo mobile app) without
// going through the browser-based authorization-code flow.
//
// IMPORTANT: access tokens are minted in the provider's default *opaque* format (we do
// NOT set a resourceServer). checkClientCredentials.js only accepts *JWT* access tokens
// from 'super' API clients; opaque tokens are looked up in the oidc_payloads table and
// set req.session.userId for any client, which is exactly what we want for the mobile
// client. Token refresh and revocation still happen through the standard provider
// endpoints (/noo/oauth/token, /noo/oauth/token/revocation) because these are real
// oidc-provider tokens.
import oidc from './OpenIDConnect'

export const NATIVE_CLIENT_ID = 'hylo-mobile'
const SCOPE = 'openid offline_access email profile'

// Issues an access + refresh token pair for `user` against a first-party native client.
export async function mintTokensForUser (user, { clientId = NATIVE_CLIENT_ID } = {}) {
  const accountId = String(user.id)
  const client = await oidc.Client.find(clientId)
  if (!client) throw new Error(`OIDC client not found: ${clientId}`)

  // A Grant records the user's consent for this client; both tokens reference it so the
  // standard refresh_token grant can validate scope on refresh.
  const grant = new oidc.Grant({ accountId, clientId })
  grant.addOIDCScope(SCOPE)
  const grantId = await grant.save()

  const accessToken = new oidc.AccessToken({ accountId, client, grantId, scope: SCOPE })
  const accessTokenValue = await accessToken.save()

  const refreshToken = new oidc.RefreshToken({ accountId, client, grantId, scope: SCOPE })
  const refreshTokenValue = await refreshToken.save()

  return {
    access_token: accessTokenValue,
    refresh_token: refreshTokenValue,
    token_type: 'Bearer',
    expires_in: accessToken.expiration
  }
}
