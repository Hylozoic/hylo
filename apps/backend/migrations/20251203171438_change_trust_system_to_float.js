exports.up = async function (knex) {
  await knex.schema.alterTable('trust_expressions', table => {
    // Change value from integer to float to store percentages
    table.float('value').notNullable().defaultTo(0.0).alter()
  })

  await knex.schema.alterTable('groups_roles', table => {
    // Change thresholds from integer to float to store average scores
    table.float('threshold_current').defaultTo(0.0).alter()
    table.float('threshold_required').defaultTo(0.51).alter() // Default to 50% + 1
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('trust_expressions', table => {
    table.integer('value').notNullable().defaultTo(0).alter()
  })

  await knex.schema.alterTable('groups_roles', table => {
    table.integer('threshold_current').defaultTo(0).alter()
    table.integer('threshold_required').defaultTo(0).alter()
  })
}