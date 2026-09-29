/**
 * Explorer review for Public groups.
 *
 * New Public top-level groups wait in the "New public groups" list in
 * Management until a Hylo admin approves them for the Group Explorer
 * (groups.allow_in_public). explorer_status holds where a group is in that
 * review: pending, approved, denied, or for the one-time review of groups that
 * were already listed, keep_or_unlist, kept and unlisted.
 *
 * The one-time review of groups that are already Public evaluates the quality
 * bar against the data when this migration runs (nothing is hard-coded):
 * - unlisted Public groups that pass the bar go into the review list (pending)
 * - listed Public groups that no longer pass get a keep-or-unlist review
 * The bar matches MIN_MEMBERS and ACTIVITY_WINDOW_DAYS in
 * api/graphql/mutations/explorerReview.js.
 *
 * Also adds an index on posts.created_at, which the "Recently active" Explorer
 * sort and the review list use to count recent posts. The index is built
 * concurrently, so this migration runs outside a transaction and every step
 * is safe to re-run.
 */

const MIN_MEMBERS = 3
const ACTIVITY_WINDOW_DAYS = 90
const PUBLIC_VISIBILITY = 2

exports.config = { transaction: false }

exports.MIN_MEMBERS = MIN_MEMBERS
exports.ACTIVITY_WINDOW_DAYS = ACTIVITY_WINDOW_DAYS

/**
 * Queue the existing Public top-level groups for the one-time review.
 * Groups that already have an explorer_status are left alone.
 * @returns {Promise<{ pending: number, keepOrUnlist: number }>}
 */
exports.backfill = async function backfill (knex, { minMembers = MIN_MEMBERS, activityWindowDays = ACTIVITY_WINDOW_DAYS } = {}) {
  const quality = `
    SELECT g.id,
      g.allow_in_public IS TRUE AS listed,
      (
        (SELECT count(*) FROM group_memberships gm WHERE gm.group_id = g.id AND gm.active = true) >= :minMembers
        AND EXISTS (
          SELECT 1
          FROM groups_posts gp
          JOIN posts p ON p.id = gp.post_id
          WHERE gp.group_id = g.id
            AND p.active = true
            AND p.type NOT IN ('welcome', 'chat_activity')
            AND p.created_at >= now() - make_interval(days => :activityWindowDays)
        )
      ) AS meets_bar
    FROM groups g
    WHERE g.active = true
      AND g.visibility = :publicVisibility
      AND (g.type IS NULL OR g.type <> 'space')
      AND g.explorer_status IS NULL
  `
  const bindings = { minMembers, activityWindowDays, publicVisibility: PUBLIC_VISIBILITY }

  const pending = await knex.raw(`
    UPDATE groups SET explorer_status = 'pending'
    FROM (${quality}) AS quality
    WHERE groups.id = quality.id AND NOT quality.listed AND quality.meets_bar
  `, bindings)

  const keepOrUnlist = await knex.raw(`
    UPDATE groups SET explorer_status = 'keep_or_unlist'
    FROM (${quality}) AS quality
    WHERE groups.id = quality.id AND quality.listed AND NOT quality.meets_bar
  `, bindings)

  return { pending: pending.rowCount, keepOrUnlist: keepOrUnlist.rowCount }
}

exports.up = async function (knex) {
  await knex.raw('ALTER TABLE groups ADD COLUMN IF NOT EXISTS explorer_status character varying(32)')
  await knex.raw('ALTER TABLE groups ADD COLUMN IF NOT EXISTS explorer_reviewed_at timestamp with time zone')
  await knex.raw('ALTER TABLE groups ADD COLUMN IF NOT EXISTS explorer_reviewed_by_id bigint')
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_explorer_reviewed_by_id_foreign') THEN
        ALTER TABLE groups ADD CONSTRAINT groups_explorer_reviewed_by_id_foreign
          FOREIGN KEY (explorer_reviewed_by_id) REFERENCES users(id);
      END IF;
    END $$;
  `)
  await knex.raw('CREATE INDEX IF NOT EXISTS groups_explorer_status_index ON groups (explorer_status) WHERE explorer_status IS NOT NULL')
  await knex.raw('CREATE INDEX CONCURRENTLY IF NOT EXISTS posts_created_at_index ON posts (created_at)')

  const counts = await exports.backfill(knex)
  console.log(`Explorer review: ${counts.pending} unlisted Public groups queued for approval, ${counts.keepOrUnlist} listed groups queued for a keep-or-unlist review`)
}

exports.down = async function (knex) {
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS posts_created_at_index')
  await knex.raw('DROP INDEX IF EXISTS groups_explorer_status_index')
  await knex.raw('ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_explorer_reviewed_by_id_foreign')
  await knex.raw('ALTER TABLE groups DROP COLUMN IF EXISTS explorer_reviewed_by_id')
  await knex.raw('ALTER TABLE groups DROP COLUMN IF EXISTS explorer_reviewed_at')
  await knex.raw('ALTER TABLE groups DROP COLUMN IF EXISTS explorer_status')
}
