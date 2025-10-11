exports.up = async function (knex) {
  await knex.schema.createTable('funding_rounds', table => {
    table.increments().primary()
    table.bigInteger('group_id').references('id').inTable('groups').index().notNullable()
    table.string('title').notNullable()
    table.text('banner_url')
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
    table.integer('num_submissions').defaultTo(0)
    table.integer('num_participants').defaultTo(0)
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  await knex.raw('alter table funding_rounds alter constraint funding_rounds_group_id_foreign deferrable initially deferred')

  await knex.schema.createTable('funding_rounds_posts', table => {
    table.increments().primary()
    table.bigInteger('funding_round_id').references('id').inTable('funding_rounds').index().notNullable()
    table.bigInteger('post_id').references('id').inTable('posts').notNullable()
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  await knex.raw('alter table funding_rounds_posts alter constraint funding_rounds_posts_funding_round_id_foreign deferrable initially deferred')
  await knex.raw('alter table funding_rounds_posts alter constraint funding_rounds_posts_post_id_foreign deferrable initially deferred')

  await knex.schema.createTable('funding_rounds_users', table => {
    table.increments().primary()
    table.bigInteger('funding_round_id').references('id').inTable('funding_rounds').index().notNullable()
    table.bigInteger('user_id').references('id').inTable('users').index().notNullable()
    table.jsonb('settings').defaultTo('{ }')
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  await knex.raw('alter table funding_rounds_users alter constraint funding_rounds_users_funding_round_id_foreign deferrable initially deferred')
  await knex.raw('alter table funding_rounds_users alter constraint funding_rounds_users_user_id_foreign deferrable initially deferred')

  await knex.schema.alterTable('posts', table => {
    table.string('budget')
  })

  const [responsibility] = await knex('responsibilities').insert({
    title: 'Manage Rounds',
    description: 'The ability to create, edit, and delete funding rounds.',
    type: 'system'
  }).returning('*')

  await knex('common_roles_responsibilities').insert({
    common_role_id: 1,
    responsibility_id: responsibility.id
  })

  await knex.schema.table('activities', table => {
    table.bigInteger('funding_round_id').references('id').inTable('funding_rounds')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('posts', table => {
    table.dropColumn('budget')
  })

  const responsibility = await knex('responsibilities').where('title', 'Manage Rounds').first()
  if (responsibility) {
    await knex('common_roles_responsibilities').where('responsibility_id', responsibility.id).delete()
    await knex('responsibilities').where('id', responsibility.id).delete()
  }

  await knex.schema.table('activities', table => {
    table.dropColumn('funding_round_id')
  })

  await knex.schema.dropTable('funding_rounds_posts')
  await knex.schema.dropTable('funding_rounds_users')
  await knex.schema.dropTable('funding_rounds')
}
