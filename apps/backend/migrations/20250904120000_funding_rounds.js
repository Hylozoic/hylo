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
    table.timestamp('published_at')
    table.timestamp('submissions_open_at')
    table.timestamp('submissions_close_at')
    table.timestamp('voting_opens_at')
    table.timestamp('voting_closes_at')
    table.string('submission_descriptor')
    table.string('submission_descriptor_plural')
    table.bigInteger('submitter_role_id')
    table.string('submitter_role_type')
    table.bigInteger('voter_role_id')
    table.string('voter_role_type')
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  await knex.raw('alter table funding_rounds alter constraint funding_rounds_group_id_foreign deferrable initially deferred')
}

exports.down = async function (knex) {
  await knex.schema.dropTable('funding_rounds')
}
