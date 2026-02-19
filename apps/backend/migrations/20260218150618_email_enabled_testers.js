exports.up = async function (knex) {
  await knex.schema.createTable('email_enabled_testers', table => {
    table.increments().primary()
    table.bigInteger('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable()
    table.timestamp('created_at')
    table.timestamp('updated_at')
    table.unique('user_id')
  })

  await knex.raw('alter table email_enabled_testers alter constraint email_enabled_testers_user_id_foreign deferrable initially deferred')

  await knex.schema.alterTable('email_enabled_testers', table => {
    table.index('user_id')
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTable('email_enabled_testers')
}

