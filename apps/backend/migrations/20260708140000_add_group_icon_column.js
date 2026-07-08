// Add a Lucide/Hylo icon name column to groups (used by Spaces without a custom avatar).

const CHAT_SPACE_ICON = 'MessageCircleMore'
const TRACK_SPACE_ICON = 'Shapes'
const FUNDING_ROUND_SPACE_ICON = 'BadgeDollarSign'

exports.up = async function (knex) {
  await knex.schema.table('groups', table => {
    table.string('icon')
  })

  // Move any icon previously stored in settings (from early createSpace) onto the column.
  await knex.raw(`
    UPDATE groups
    SET icon = settings->>'icon'
    WHERE settings->>'icon' IS NOT NULL
      AND icon IS NULL
  `)

  // Chat-room spaces migrated from context_widgets have home_route = '/chat'.
  await knex('groups')
    .where({ type: 'space', home_route: '/chat' })
    .update({ icon: CHAT_SPACE_ICON })

  // Track spaces created by the context_widgets migration.
  await knex('groups')
    .where({ type: 'space' })
    .whereNotNull('track_id')
    .update({ icon: TRACK_SPACE_ICON })

  // Funding round spaces created by the context_widgets migration.
  await knex('groups')
    .where({ type: 'space' })
    .whereNotNull('funding_round_id')
    .update({ icon: FUNDING_ROUND_SPACE_ICON })

  await knex.raw(`
    UPDATE groups
    SET settings = settings - 'icon'
    WHERE jsonb_exists(settings, 'icon')
  `)
}

exports.down = async function (knex) {
  await knex.schema.table('groups', table => {
    table.dropColumn('icon')
  })
}
