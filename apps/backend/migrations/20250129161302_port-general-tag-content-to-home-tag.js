exports.up = function(knex) {
  // const generalTag = await knex.raw(`
  //   SELECT id FROM tags WHERE name = 'general' LIMIT 1
  // `)
  // const homeTag = await knex.raw(`
  //   SELECT id FROM tags WHERE name = 'home' LIMIT 1
  // `)

  // if (!generalTag?.rows?.[0] || !homeTag?.rows?.[0]) {
  //   console.log('Missing required tags, skipping migration')
  //   return
  // }

  // const generalTagId = generalTag.rows[0].id
  // const homeTagId = homeTag.rows[0].id

  // await knex.raw(`
  //   UPDATE posts_tags
  //   SET tag_id = ?
  //   WHERE tag_id = ?
  // `, [homeTagId, generalTagId])
  console.log("Port general tag content to home tag")
  return Promise.resolve()
};

exports.down = function(knex) {
  // const generalTag = await knex.raw(`
  //   SELECT id FROM tags WHERE name = 'general' LIMIT 1
  // `)
  // const homeTag = await knex.raw(`
  //   SELECT id FROM tags WHERE name = 'home' LIMIT 1
  // `)

  // if (!generalTag?.rows?.[0] || !homeTag?.rows?.[0]) {
  //   console.log('Missing required tags, skipping migration')
  //   return
  // }

  // const generalTagId = generalTag.rows[0].id
  // const homeTagId = homeTag.rows[0].id

  // await knex.raw(`
  //   UPDATE posts_tags
  //   SET tag_id = ?
  //   WHERE tag_id = ?
  // `, [generalTagId, homeTagId])
  return Promise.resolve()
};
