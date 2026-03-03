import OIDCAdapter from '../../api/services/oidc/KnexAdapter'
import { decodeHyloJWT } from '../../lib/HyloJWT'

module.exports = async (req, res, next) => {
  const TOKEN_RE = /^Bearer (.+)$/i
  const match = req.headers.authorization && req.headers.authorization.match(TOKEN_RE)
  let clientId
  if (match) {
    const token = match[1]

    try {
      // Look for a JWT for API clients using the Client Credentials oAuth flow
      const decoded = decodeHyloJWT(token)
      clientId = decoded.client_id

      // TODO: check scopes/claims? or is that already happening in the OIDC resource server code?
      //       I think it is checking if scope is ok there but probably need to check here too?
      
      // First check if this is a registered OIDC client
      const client = await (new OIDCAdapter("Client")).find(clientId)
      
      if (client) {
        // Traditional OIDC client - check for super role
        if (client.role !== 'super') {
          return res.status(403).json({ error: 'Unauthorized' })
        }
        req.api_client = { id: clientId, name: client.name, scope: decoded.scope, super: true }
      } else {
        // Check if this is a bot/application using our Application model
        const app = await Application.findByClientId(clientId)
        
        if (app && decoded.scope && decoded.scope.includes('bot')) {
          // Bot authentication - verify the secret was correct (JWT was issued)
          const botUserId = app.get('bot_user_id')
          
          if (!botUserId) {
            return res.status(403).json({ error: 'Application does not have a bot' })
          }
          
          // Set the session to the bot user
          req.session.userId = botUserId
          req.api_client = { 
            id: clientId, 
            name: app.get('name'), 
            scope: decoded.scope,
            is_bot: true,
            bot_user_id: botUserId,
            application_id: app.id
          }
        } else {
          return res.status(403).json({ error: 'Unauthorized' })
        }
      }
    } catch (e) {
      // Not a JWT, look up token in the oidc_payloads table to see if it as an AccessToken for the Authorization Code oAuth flow
      const accessToken = await (new OIDCAdapter("AccessToken")).find(token)
      const expiresAt = accessToken && new Date(accessToken.exp * 1000)

      if (expiresAt && expiresAt > Date.now()) {
        clientId = accessToken.clientId
        const client = await (new OIDCAdapter("Client")).find(clientId)
        if (!client) {
          return res.status(403).json({ error: 'Unauthorized' })
        }

        req.api_client = { id: clientId, name: client.name, scope: accessToken.scope }

        // Log user in using Access Token
        req.session.userId = accessToken.accountId
      } else {
        console.error("Error decoding token", e.message)
        return res.status(401).json({ error: 'Unauthorized' })
      }
    }
  }

  return next()
}
