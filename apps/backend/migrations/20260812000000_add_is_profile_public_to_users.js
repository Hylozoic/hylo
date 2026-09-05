exports.up = async function (knex) {
  await knex.schema.alterTable('users', table => {
    table.boolean('is_profile_public').defaultTo(false)
  })
  await knex.raw(`
    CREATE INDEX users_public_profiles_idx
    ON users (id)
    WHERE is_profile_public = true
  `)
}

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS users_public_profiles_idx')
  await knex.schema.alterTable('users', table => {
    table.dropColumn('is_profile_public')
  })
}
