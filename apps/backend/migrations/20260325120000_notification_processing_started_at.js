exports.up = async function (knex) {
  await knex.schema.alterTable('notifications', table => {
    table.timestamp('processing_started_at')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('notifications', table => {
    table.dropColumn('processing_started_at')
  })
}
