#!/usr/bin/env node
/**
 * Generate a test access token for API testing
 *
 * Usage:
 *   OIDC_KEYS=base64key USER_ID=123 node generate-test-token.js
 */

import crypto from 'crypto'

// Get the private key from environment
const oidcKeysBase64 = process.env.OIDC_KEYS?.split(',')[0]
if (!oidcKeysBase64) {
  console.error('OIDC_KEYS environment variable is required')
  process.exit(1)
}

const userId = process.env.USER_ID || '5007'
const scopes = process.env.SCOPES || 'openid profile email api:read api:write'
const issuer = process.env.ISSUER || 'http://localhost:3001'

// Decode the private key
const privateKey = Buffer.from(oidcKeysBase64, 'base64').toString('utf8')

// Create JWT header
const header = {
  alg: 'RS256',
  typ: 'at+jwt'
}

// Create JWT payload (access token claims)
const now = Math.floor(Date.now() / 1000)
const payload = {
  iss: issuer,
  sub: String(userId),
  aud: issuer,
  exp: now + 3600, // 1 hour
  iat: now,
  scope: scopes,
  client_id: 'test-client',
  jti: crypto.randomUUID()
}

// Base64url encode
function base64urlEncode(data) {
  const base64 = Buffer.from(JSON.stringify(data)).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Sign the token
const headerEncoded = base64urlEncode(header)
const payloadEncoded = base64urlEncode(payload)
const signatureInput = `${headerEncoded}.${payloadEncoded}`

const sign = crypto.createSign('RSA-SHA256')
sign.update(signatureInput)
const signature = sign.sign(privateKey, 'base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '')

const token = `${signatureInput}.${signature}`

console.log('Generated Access Token:')
console.log('=' .repeat(50))
console.log(token)
console.log('=' .repeat(50))
console.log('')
console.log('Token Details:')
console.log(`  User ID: ${userId}`)
console.log(`  Scopes: ${scopes}`)
console.log(`  Issuer: ${issuer}`)
console.log(`  Expires: ${new Date((now + 3600) * 1000).toISOString()}`)
console.log('')
console.log('To use with the API test bot:')
console.log(`  ACCESS_TOKEN="${token}" node api-test-bot.js`)
