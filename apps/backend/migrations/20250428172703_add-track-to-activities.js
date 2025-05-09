exports.up = async function (knex) {
  await knex.schema.table('activities', table => {
    table.bigInteger('track_id').references('id').inTable('tracks')
  })
}

exports.down = async function (knex) {
  await knex.schema.table('activities', table => {
    table.dropColumn('track_id')
  })
}
