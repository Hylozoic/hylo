exports.up = async function (knex) {
  await knex.schema.table('tag_follows', t => {
    t.jsonb('settings').defaultTo('{ }') // no notifications value is a signal that this is not a chat room subscription yet
  })
}

exports.down = function (knex) {
  return knex.schema.table('tag_follows', t => {
    t.dropColumn('settings')
  })
}
