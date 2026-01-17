exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

  await knex.raw(`
    UPDATE groups
    SET calendar_token = uuid_generate_v4()::text
    WHERE calendar_token IS NULL OR calendar_token = ''
  `)
}

exports.down = function (knex) {
  return Promise.resolve()
}
