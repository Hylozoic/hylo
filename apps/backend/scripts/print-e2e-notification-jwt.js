/**
 * Prints a one-line RS256 JWT for the seeded E2E user so Playwright can hit
 * GET /noo/user/notification-settings with a valid token (same shape as email links).
 * Requires DATABASE_URL, OIDC_KEYS, PROTOCOL, DOMAIN (same as isolated backend).
 */
const { Client } = require('pg')
const jwt = require('jsonwebtoken')

const E2E_USER_EMAIL = 'e2e.user@hylo.test'

async function main () {
  if (!process.env.DATABASE_URL) {
    console.error('[print-e2e-notification-jwt] DATABASE_URL is required')
    process.exit(1)
  }
  if (!process.env.OIDC_KEYS) {
    console.error('[print-e2e-notification-jwt] OIDC_KEYS is required (see apps/backend/.env)')
    process.exit(1)
  }
  if (!process.env.DOMAIN || !process.env.PROTOCOL) {
    console.error('[print-e2e-notification-jwt] PROTOCOL and DOMAIN are required')
    process.exit(1)
  }

  const sslMode = (process.env.PGSSLMODE || 'disable').toLowerCase()
  const useSsl =
    sslMode === 'require' ||
    sslMode === 'verify-full' ||
    sslMode === 'verify-ca'
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  })
  await client.connect()
  const { rows } = await client.query(
    'SELECT id FROM users WHERE lower(email) = lower($1)',
    [E2E_USER_EMAIL]
  )
  await client.end()

  if (!rows.length) {
    console.error('[print-e2e-notification-jwt] Seed user not found:', E2E_USER_EMAIL)
    process.exit(1)
  }

  const userId = rows[0].id
  const privateKey = Buffer.from(process.env.OIDC_KEYS.split(',')[0], 'base64')
  const origin = `${process.env.PROTOCOL}://${process.env.DOMAIN}`
  const token = jwt.sign(
    {
      iss: origin,
      aud: origin,
      sub: String(userId),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      action: 'notification_settings'
    },
    privateKey,
    { algorithm: 'RS256' }
  )
  process.stdout.write(token + '\n')
}

main().catch((err) => {
  console.error('[print-e2e-notification-jwt]', err)
  process.exit(1)
})
