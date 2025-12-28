/**
 * Migration: Backfill user_scopes table
 *
 * This migration populates the user_scopes table with data from existing content_access records.
 * Since we've created database triggers that automatically maintain user_scopes when content_access
 * records are inserted/updated/deleted, we just need to trigger those functions for existing data.
 *
 * We do this by touching (updating) all active content_access records, which will fire the
 * compute_user_scopes_from_content_access() trigger function.
 */

exports.up = async function (knex) {
  console.log('Starting backfill of user_scopes from existing content_access records...')

  // Get count of active content_access records
  const [{ count }] = await knex('content_access')
    .where('status', 'active')
    .count('* as count')

  console.log(`Found ${count} active content_access records to process`)

  if (parseInt(count, 10) === 0) {
    console.log('No records to backfill, migration complete')
    return
  }

  // Update all active content_access records to trigger the database function
  // We use updated_at to track that they've been touched
  await knex.raw(`
    UPDATE content_access
    SET updated_at = NOW()
    WHERE status = 'active';
  `)

  // Verify that user_scopes were created
  const [{ scopeCount }] = await knex('user_scopes')
    .count('* as scopeCount')

  console.log(`Backfill complete! Created ${scopeCount} user_scope records`)
}

exports.down = async function (knex) {
  console.log('Rolling back user_scopes backfill...')

  // Delete all user_scopes records
  // Note: This is safe because the triggers will recreate them as needed
  await knex('user_scopes').del()

  console.log('User_scopes table cleared')
}

