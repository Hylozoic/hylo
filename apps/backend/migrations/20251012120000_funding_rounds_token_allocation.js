exports.up = async function (knex) {
  // Add tokens_distributed_at to funding_rounds table
  await knex.schema.alterTable('funding_rounds', table => {
    table.timestamp('tokens_distributed_at')
  })

  // Add tokens_remaining to funding_rounds_users table
  await knex.schema.alterTable('funding_rounds_users', table => {
    table.integer('tokens_remaining').defaultTo(0)
  })

  // Add tokens_allocated_to to posts_users table
  await knex.schema.alterTable('posts_users', table => {
    table.integer('tokens_allocated_to').defaultTo(0)
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('funding_rounds', table => {
    table.dropColumn('tokens_distributed_at')
  })

  await knex.schema.alterTable('funding_rounds_users', table => {
    table.dropColumn('tokens_remaining')
  })

  await knex.schema.alterTable('posts_users', table => {
    table.dropColumn('tokens_allocated_to')
  })
}
