/**
 * Prints a one-line unsubscribe token (lib/email/unsubscribeToken.js) for the seeded E2E
 * user and the E2E public group's digest, the shape a group digest's unsubscribe link
 * carries, so Playwright can open /email/unsubscribe (e2e/email-unsubscribe.spec.js).
 * Requires DATABASE_URL, OIDC_KEYS, PROTOCOL, DOMAIN (same as the isolated backend).
 */
const { Client } = require('pg')
const jwt = require('jsonwebtoken')

const E2E_USER_EMAIL = 'e2e.user@hylo.test'
const E2E_GROUP_SLUG = 'e2e-public-group'

async function main () {
  for (const key of ['DATABASE_URL', 'OIDC_KEYS', 'PROTOCOL', 'DOMAIN']) {
    if (!process.env[key]) {
      console.error(`[print-e2e-unsubscribe-jwt] ${key} is required`)
      process.exit(1)
    }
  }

  const sslMode = (process.env.PGSSLMODE || 'disable').toLowerCase()
  const useSsl = ['require', 'verify-full', 'verify-ca'].includes(sslMode)
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  })
  await client.connect()
  const user = await client.query('SELECT id FROM users WHERE lower(email) = lower($1)', [E2E_USER_EMAIL])
  const group = await client.query('SELECT id FROM groups WHERE slug = $1', [E2E_GROUP_SLUG])
  await client.end()

  if (!user.rows.length || !group.rows.length) {
    console.error('[print-e2e-unsubscribe-jwt] Seed user or group not found')
    process.exit(1)
  }

  const privateKey = Buffer.from(process.env.OIDC_KEYS.split(',')[0], 'base64')
  const origin = `${process.env.PROTOCOL}://${process.env.DOMAIN}`
  const token = jwt.sign(
    {
      iss: origin,
      aud: origin,
      sub: String(user.rows[0].id),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      action: 'email_unsubscribe',
      ud: 'group_digest',
      et: 'sendSimpleEmail',
      gid: String(group.rows[0].id)
    },
    privateKey,
    { algorithm: 'RS256' }
  )
  process.stdout.write(token + '\n')
}

main().catch((err) => {
  console.error('[print-e2e-unsubscribe-jwt]', err)
  process.exit(1)
})
