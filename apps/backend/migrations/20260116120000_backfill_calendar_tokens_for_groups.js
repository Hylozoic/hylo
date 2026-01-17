const { v4: uuidv4 } = require('uuid')

exports.up = async function (knex) {
  const groups = await knex('groups')
    .select('id')
    .whereNull('calendar_token')
    .orWhere('calendar_token', '')

  for (const group of groups) {
    await knex('groups')
      .where({ id: group.id })
      .update({ calendar_token: uuidv4() })
  }
}

exports.down = function (knex) {
  return Promise.resolve()
}
