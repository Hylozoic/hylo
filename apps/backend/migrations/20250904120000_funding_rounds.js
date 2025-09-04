exports.up = async function (knex) {
  await knex.schema.createTable('funding_rounds', table => {
    table.increments().primary()
    table.bigInteger('group_id').references('id').inTable('groups').index().notNullable()
    table.string('title').notNullable()
    table.text('description')
    table.text('criteria')
    table.boolean('require_budget').defaultTo(false)
    table.string('voting_method').notNullable()
    table.string('token_type')
    table.integer('total_tokens')
    table.integer('min_token_allocation')
    table.integer('max_token_allocation')
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  await knex.raw('alter table funding_rounds alter constraint funding_rounds_group_id_foreign deferrable initially deferred')
}

exports.down = async function (knex) {
  await knex.schema.dropTable('funding_rounds')
}
