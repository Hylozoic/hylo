exports.up = async function(knex) {
  let homeTag = await knex('tags')
    .where({ name: 'home' })
    .first()
  if (!homeTag) {
    const [id] = await knex('tags')
      .insert({
        name: 'home',
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('id')
    homeTag = await knex('tags')
      .where({ id })
      .first()
  }

  return Promise.resolve()
}

exports.down = async function(knex, Promise) {
}
