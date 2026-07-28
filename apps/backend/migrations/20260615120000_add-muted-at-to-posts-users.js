exports.up = async function (knex) {
  await knex.schema.alterTable('posts_users', table => {
    table.timestamp('muted_at')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('posts_users', table => {
    table.dropColumn('muted_at')
  })
}
