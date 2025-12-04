exports.up = async function (knex) {
  await knex.schema.alterTable('posts_users', table => {
    table.timestamp('saved_at')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('posts_users', table => {
    table.dropColumn('saved_at')
  })
}

