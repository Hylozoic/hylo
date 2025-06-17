exports.up = async function (knex) {
  await knex.schema.table('posts', table => {
    table.integer('num_commenters').defaultTo(0)
  })

  await knex.raw(`
    UPDATE posts
    SET num_commenters = (
      SELECT COUNT(DISTINCT users.id)
      FROM users
      INNER JOIN comments ON comments.user_id = users.id
      WHERE comments.post_id = posts.id
        AND comments.active = true
        AND users.active = true
    );
  `)
}

exports.down = async function (knex) {
  await knex.schema.table('tracks', table => {
    table.dropColumn('num_commenters')
  })
}
