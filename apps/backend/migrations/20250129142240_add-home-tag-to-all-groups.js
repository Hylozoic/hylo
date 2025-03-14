/* globals Tag, GroupTag, User */
require("@babel/register")
const models = require('../api/models')

exports.up = async function(knex) {
  models.init()

  return bookshelf.transaction(async transacting => {
    // First fetch or create the home tag
    let homeTag = await Tag.where({ name: 'home' }).fetch({ transacting })
    if (!homeTag) {
      homeTag = await Tag.forge({
        name: 'home',
        created_at: new Date(),
        updated_at: new Date()
      }).save(null, { transacting })
    }
  })
}

exports.down = async function(knex) {
  models.init()
  const homeTag = await Tag.where({ name: 'home' }).fetch()
  if (homeTag) {
    return knex('groups_tags')
      .where({ tag_id: homeTag.get('id') })
      .del()
  }
  return Promise.resolve()
}
