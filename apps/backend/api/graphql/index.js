import { createYoga } from 'graphql-yoga'
import { red } from 'chalk'
import { inspect } from 'util'
import crypto from 'crypto'
import RedisPubSub from '../services/RedisPubSub'
import makeSchema from './makeSchema'

export const GRAPHQL_ENDPOINT = '/noo/graphql'

// Test secret for bot authentication - in production use OIDC_KEY or proper JWT verification
const BOT_AUTH_SECRET = process.env.BOT_AUTH_SECRET || 'test-bot-secret-key-for-local-development'

/**
 * Verify HMAC-signed JWT token
 */
function verifyToken(token, secret) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const [headerB64, payloadB64, signatureB64] = parts
    
    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(headerB64 + '.' + payloadB64)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
    
    if (signatureB64 !== expectedSig) {
      return null
    }
    
    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    
    return payload
  } catch (e) {
    return null
  }
}

/**
 * Extract user ID from Bearer token (for bot/API access)
 */
async function getUserIdFromToken(req) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  
  // Try our simple HMAC token first (for bot testing)
  const payload = verifyToken(token, BOT_AUTH_SECRET)
  if (payload && payload.sub) {
    const userId = parseInt(payload.sub, 10)
    
    // Verify user exists
    const user = await User.find(userId)
    if (user) {
      sails.log.info('Bot/API authentication successful for user:', userId)
      return userId
    }
  }
  
  return null
}

export const yoga = createYoga({
  graphqlEndpoint: GRAPHQL_ENDPOINT,
  schema: makeSchema,
  context: async ({ req, params }) => {
    if (process.env.DEBUG_GRAPHQL) {
      sails.log.info('\n' +
        red('graphql query start') + '\n' +
        params?.query + '\n' +
        red('graphql query end')
      )
      sails.log.info(inspect(params?.variables))
    }

    // Determine current user ID - first try session, then Bearer token
    let currentUserId = req.session?.userId
    
    if (!currentUserId) {
      currentUserId = await getUserIdFromToken(req)
    }

    // Update user last active time unless this is an oAuth login
    if (currentUserId && !req.api_client) {
      await User.query().where({ id: currentUserId }).update({ last_active_at: new Date() })
    }

    return {
      pubSub: RedisPubSub,
      socket: req.socket,
      currentUserId
    }
  },
  logging: process.env.GRAPHQL_YOGA_LOG_LEVEL || 'info',
  graphiql: true
})

export default yoga
