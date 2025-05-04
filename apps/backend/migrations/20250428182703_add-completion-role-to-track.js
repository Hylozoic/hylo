exports.up = async function (knex) {
  await knex.schema.table('tracks', table => {
    table.bigInteger('completion_role_id')
    table.string('completion_role_type')
    table.dropColumn('completion_badge_name')
    table.dropColumn('completion_badge_emoji')
  })
}

exports.down = async function (knex) {
  await knex.schema.table('tracks', table => {
    table.dropColumn('completion_role_id')
    table.dropColumn('completion_role_type')
    table.string('completion_badge_name')
    table.string('completion_badge_emoji')
  })
}
