exports.up = async function (knex) {
  await knex.schema.alterTable('users', t => {
    t.dropColumn('facebook_url')
    t.dropColumn('linkedin_url')
    t.dropColumn('twitter_name')
    t.dropColumn('url')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('users', t => {
    t.string('facebook_url')
    t.string('linkedin_url')
    t.string('twitter_name')
    t.string('url')
  })
}
