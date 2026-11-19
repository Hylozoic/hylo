/**
 * Let moderation reports point at more than a post:
 * - comment_id: a report about one comment (post_id stays set to the comment's
 *   post, so the report shows in that post's group queue).
 * - reported_user_id / message_thread_id: a report about a person or a direct
 *   message conversation. These go to Hylo staff rather than a group, so
 *   post_id becomes nullable.
 * - queue: 'group' (the group's moderation queue, as before) or 'staff'.
 * - category: the reason picked for staff reports (spam, abusive, ...).
 * - resolved_by_id / resolved_at: who closed a staff report, and when.
 *
 * down() deletes the rows the old shape can't hold (staff reports and any
 * report without a post) before restoring NOT NULL on post_id.
 */

exports.up = async function (knex) {
  await knex.raw('ALTER TABLE moderation_actions ALTER COLUMN post_id DROP NOT NULL')

  await knex.raw('ALTER TABLE moderation_actions ADD COLUMN IF NOT EXISTS comment_id bigint')
  await knex.raw('ALTER TABLE moderation_actions ADD COLUMN IF NOT EXISTS reported_user_id bigint')
  await knex.raw('ALTER TABLE moderation_actions ADD COLUMN IF NOT EXISTS message_thread_id bigint')
  await knex.raw("ALTER TABLE moderation_actions ADD COLUMN IF NOT EXISTS queue character varying(16) DEFAULT 'group' NOT NULL")
  await knex.raw('ALTER TABLE moderation_actions ADD COLUMN IF NOT EXISTS category character varying(32)')
  await knex.raw('ALTER TABLE moderation_actions ADD COLUMN IF NOT EXISTS resolved_by_id bigint')
  await knex.raw('ALTER TABLE moderation_actions ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone')

  const constraints = [
    ['moderation_actions_queue_check', "CHECK (queue::text IN ('group', 'staff'))"],
    ['moderation_actions_comment_id_foreign', 'FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE'],
    ['moderation_actions_reported_user_id_foreign', 'FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE SET NULL'],
    ['moderation_actions_message_thread_id_foreign', 'FOREIGN KEY (message_thread_id) REFERENCES posts(id) ON DELETE SET NULL'],
    ['moderation_actions_resolved_by_id_foreign', 'FOREIGN KEY (resolved_by_id) REFERENCES users(id) ON DELETE SET NULL']
  ]
  for (const [name, definition] of constraints) {
    await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ALTER TABLE moderation_actions ADD CONSTRAINT ${name} ${definition} NOT VALID;
        END IF;
      END $$
    `)
    await knex.raw(`ALTER TABLE moderation_actions VALIDATE CONSTRAINT ${name}`)
  }

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS moderation_actions_comment_id_index
    ON moderation_actions (comment_id) WHERE comment_id IS NOT NULL
  `)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS moderation_actions_staff_queue_index
    ON moderation_actions (status, created_at) WHERE queue = 'staff'
  `)
}

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS moderation_actions_staff_queue_index')
  await knex.raw('DROP INDEX IF EXISTS moderation_actions_comment_id_index')

  const hasQueue = await knex.schema.hasColumn('moderation_actions', 'queue')
  const staffIds = hasQueue
    ? knex('moderation_actions').select('id').where('queue', 'staff')
    : knex('moderation_actions').select('id').whereRaw('false')
  const orphanIds = knex('moderation_actions').select('id').whereNull('post_id')
  for (const ids of [staffIds, orphanIds]) {
    await knex('moderation_actions_agreements').whereIn('moderation_action_id', ids.clone()).del()
    await knex('moderation_actions_platform_agreements').whereIn('moderation_action_id', ids.clone()).del()
    await knex('moderation_actions').whereIn('id', ids.clone()).del()
  }

  for (const name of [
    'moderation_actions_resolved_by_id_foreign',
    'moderation_actions_message_thread_id_foreign',
    'moderation_actions_reported_user_id_foreign',
    'moderation_actions_comment_id_foreign',
    'moderation_actions_queue_check'
  ]) {
    await knex.raw(`ALTER TABLE moderation_actions DROP CONSTRAINT IF EXISTS ${name}`)
  }

  for (const column of ['resolved_at', 'resolved_by_id', 'category', 'queue', 'message_thread_id', 'reported_user_id', 'comment_id']) {
    await knex.raw(`ALTER TABLE moderation_actions DROP COLUMN IF EXISTS ${column}`)
  }

  await knex.raw('ALTER TABLE moderation_actions ALTER COLUMN post_id SET NOT NULL')
}
