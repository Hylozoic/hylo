/**
 * Public AT Protocol HTTP endpoints for Hylo-hosted identities.
 *
 * Mounted ahead of cookies/sessions in config/http.js: these are hit anonymously by other
 * AT Protocol services and crawlers, so they must not create sessions or set cookies.
 *
 *   GET https://<name>.<handleDomain>/.well-known/atproto-did  → the DID, as text/plain
 *   GET /xrpc/com.atproto.identity.resolveHandle?handle=…       → { did }
 *   GET /xrpc/com.atproto.server.describeServer                 → server description
 *   GET /xrpc/_health                                           → { version }
 *   any other /xrpc/* → 501 MethodNotImplemented
 */
import { isValidHandle } from '@atproto/syntax'
import { atprotoConfig } from './config'
import { buildHandle, handleNameFromHost } from './handles'

const { version } = require('../../package.json')

// Handles can change, so let resolvers cache only briefly
const CACHE_CONTROL = 'public, max-age=60'

const xrpcError = (res, status, error, message) => res.status(status).json({ error, message })

async function activeIdentityForHandle (handle) {
  const identity = await AtprotoIdentity.findActiveByHandle(handle)
  return identity && identity.get('did')
}

// Only handles directly under our handle domain are ours to resolve
function ourHandle (handle, config) {
  const normalized = (handle || '').trim().toLowerCase()
  if (!isValidHandle(normalized)) return null
  const name = handleNameFromHost(normalized, config.handleDomain)
  return name ? buildHandle(name, config.handleDomain) : null
}

export const routes = {
  '/.well-known/atproto-did': async (req, res, config) => {
    const name = handleNameFromHost(req.hostname, config.handleDomain)
    const did = name && await activeIdentityForHandle(buildHandle(name, config.handleDomain))
    if (!did) return res.status(404).type('text/plain').send('handle not found')
    return res.set('Cache-Control', CACHE_CONTROL).type('text/plain').send(did)
  },

  '/xrpc/com.atproto.identity.resolveHandle': async (req, res, config) => {
    if (!req.query.handle) return xrpcError(res, 400, 'InvalidRequest', 'Missing required parameter: handle')
    const handle = ourHandle(req.query.handle, config)
    const did = handle && await activeIdentityForHandle(handle)
    if (!did) return xrpcError(res, 400, 'InvalidRequest', 'Unable to resolve handle')
    return res.set('Cache-Control', CACHE_CONTROL).json({ did })
  },

  '/xrpc/com.atproto.server.describeServer': async (req, res, config) => {
    return res.json({
      did: `did:web:${new URL(config.pdsUrl).hostname}`,
      availableUserDomains: [`.${config.handleDomain}`],
      // Accounts are only created by Hylo itself, never via createAccount
      inviteCodeRequired: true,
      links: {},
      contact: {}
    })
  },

  '/xrpc/_health': async (req, res) => res.json({ version })
}

export default function atprotoMiddleware (req, res, next) {
  const isXrpc = req.path.startsWith('/xrpc/')
  const handler = routes[req.path]
  if (!handler && !isXrpc) return next()

  const config = atprotoConfig()
  if (!config.enabled || !config.handleDomain || !config.pdsUrl) return next()

  // XRPC and handle resolution are public and read-only, so any origin may call them
  res.set('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return xrpcError(res, 405, 'InvalidRequest', 'Method not allowed')
  }
  if (!handler) return xrpcError(res, 501, 'MethodNotImplemented', 'Method not implemented')

  return handler(req, res, config).catch(err => {
    sails.log.error('AT Protocol endpoint failed', err)
    xrpcError(res, 500, 'InternalServerError', 'Internal Server Error')
  })
}
