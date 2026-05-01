/**
 * Minimal deterministic E2E data using a single pg connection (avoids Knex pool issues during isolated runs).
 * Expects DATABASE_URL (same as backend).
 */
const { Client } = require('pg')
const bcrypt = require('bcrypt')

const E2E_USER_EMAIL = 'e2e.user@hylo.test'
const E2E_USER_PASSWORD = 'e2e-password-123'

async function main () {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('[seed-e2e-baseline] DATABASE_URL is required')
    process.exit(1)
  }

  const sslMode = (process.env.PGSSLMODE || 'disable').toLowerCase()
  const useSsl =
    sslMode === 'require' ||
    sslMode === 'verify-full' ||
    sslMode === 'verify-ca'
  const client = new Client({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  })
  await client.connect()
  const now = new Date().toISOString()
  const userSettings = JSON.stringify({ locale: 'en' })
  const emptyGroupSettings = JSON.stringify({})

  try {
    await client.query('BEGIN')

    const userRes = await client.query(
      `INSERT INTO users (email, name, first_name, last_name, active, email_validated, created_at, updated_at, settings)
       VALUES ($1, $2, $3, $4, true, true, $5::timestamptz, $5::timestamptz, $6::jsonb)
       RETURNING id`,
      [E2E_USER_EMAIL.toLowerCase(), 'E2E User', 'E2E', 'User', now, userSettings]
    )
    const userId = userRes.rows[0].id

    const pubRes = await client.query(
      `INSERT INTO groups (
        group_data_type, active, created_at, updated_at, name, slug, description,
        visibility, accessibility, created_by_id, settings, num_members, allow_in_public
      ) VALUES (
        1, true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
        2, 1, $5, $6::jsonb, 1, true
      ) RETURNING id`,
      [now, 'E2E Public Group', 'e2e-public-group', 'Deterministic public group for Playwright E2E', userId, emptyGroupSettings]
    )
    const publicGroupId = pubRes.rows[0].id

    const privRes = await client.query(
      `INSERT INTO groups (
        group_data_type, active, created_at, updated_at, name, slug, description,
        visibility, accessibility, created_by_id, settings, num_members, allow_in_public
      ) VALUES (
        1, true, $1::timestamptz, $1::timestamptz, $2, $3, $4,
        0, 1, $5, $6::jsonb, 1, false
      ) RETURNING id`,
      [now, 'E2E Private Group', 'e2e-private-group', 'Deterministic private group for Playwright E2E', userId, emptyGroupSettings]
    )
    const privateGroupId = privRes.rows[0].id

    const membershipSettings = JSON.stringify({})
    await client.query(
      `INSERT INTO group_memberships (group_id, user_id, active, role, created_at, updated_at, settings)
       VALUES ($1, $2, true, 1, $3::timestamptz, $3::timestamptz, $4::jsonb),
              ($5, $2, true, 1, $3::timestamptz, $3::timestamptz, $4::jsonb)`,
      [publicGroupId, userId, now, membershipSettings, privateGroupId]
    )

    const postRes = await client.query(
      `INSERT INTO posts (name, description, type, created_at, updated_at, user_id, active, visibility, is_public)
       VALUES ($1, $2, 'discussion', $3::timestamptz, $3::timestamptz, $4, true, 0, true)
       RETURNING id`,
      ['E2E Public Post', 'Deterministic public post for unauthenticated route tests', now, userId]
    )
    const publicPostId = postRes.rows[0].id

    await client.query(
      'INSERT INTO groups_posts (post_id, group_id) VALUES ($1, $2)',
      [publicPostId, publicGroupId]
    )

    const passwordHash = await bcrypt.hash(E2E_USER_PASSWORD, 10)
    await client.query(
      `INSERT INTO linked_account (user_id, provider_user_id, provider_key)
       VALUES ($1, $2, 'password')`,
      [userId, passwordHash]
    )

    await client.query('COMMIT')
    console.log('[seed-e2e-baseline] ok')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('[seed-e2e-baseline]', err)
  process.exit(1)
})
