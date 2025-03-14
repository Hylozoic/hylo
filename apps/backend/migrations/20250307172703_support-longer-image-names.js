
exports.up = async function (knex) {
  await knex.schema.alterTable('media', table => {
    table.text('name').alter()
    table.text('url').alter()
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('media', table => {
    table.string('name').alter()
    table.string('url').alter()
  })
}
