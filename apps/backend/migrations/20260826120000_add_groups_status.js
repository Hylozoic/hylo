/**
 * Space lifecycle lives on groups.status (draft / published / archived, plus
 * funding-round phases). Replaces tracks.published_at, funding_rounds.published_at,
 * and funding_rounds.phase. groups.active remains the delete flag.
 */

const PUBLISHED_DEFAULT = 'published'

exports.up = async function up (knex) {
  await knex.schema.table('groups', table => {
    table.string('status').notNullable().defaultTo(PUBLISHED_DEFAULT)
    table.index(['type', 'status'])
  })

  // Old archive path used active = false. Restore active so they show in Archived.
  await knex('groups')
    .where({ type: 'space', active: false })
    .update({ status: 'archived', active: true })

  await knex.raw(`
    UPDATE groups
    SET status = funding_rounds.phase
    FROM funding_rounds
    WHERE groups.funding_round_id = funding_rounds.id
      AND groups.type = 'space'
      AND groups.status <> 'archived'
      AND funding_rounds.phase IS NOT NULL
  `)

  await knex.raw(`
    UPDATE groups
    SET status = 'draft'
    FROM tracks
    WHERE groups.track_id = tracks.id
      AND groups.type = 'space'
      AND groups.status <> 'archived'
      AND tracks.published_at IS NULL
  `)

  await knex.schema.table('tracks', table => {
    table.dropColumn('published_at')
  })

  await knex.schema.table('funding_rounds', table => {
    table.dropColumn('published_at')
    table.dropColumn('phase')
  })
}

exports.down = async function down (knex) {
  await knex.schema.table('tracks', table => {
    table.timestamp('published_at')
  })

  await knex.schema.table('funding_rounds', table => {
    table.timestamp('published_at')
    table.string('phase').defaultTo('draft')
  })

  await knex.raw(`
    UPDATE tracks
    SET published_at = groups.updated_at
    FROM groups
    WHERE tracks.group_id = groups.id
      AND groups.status NOT IN ('draft', 'archived')
  `)

  await knex.raw(`
    UPDATE funding_rounds
    SET phase = groups.status,
        published_at = CASE
          WHEN groups.status IN ('draft', 'archived') THEN NULL
          ELSE groups.updated_at
        END
    FROM groups
    WHERE funding_rounds.group_id = groups.id
  `)

  await knex('groups')
    .where({ type: 'space', status: 'archived' })
    .update({ active: false })

  await knex.schema.table('groups', table => {
    table.dropIndex(['type', 'status'])
    table.dropColumn('status')
  })
}
