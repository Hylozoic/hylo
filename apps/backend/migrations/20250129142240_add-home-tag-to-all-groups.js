/* globals Tag, GroupTag, User */
require("@babel/register")
const models = require('../api/models')

exports.up = async function(knex) {
  models.init()

  // Get all groups and their created_by_id
  // const groups = await knex('groups')
  //   .select(['id', 'created_by_id'])

  // console.log(`Adding home tag to ${groups.length} groups`)

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

    // Create GroupTags for each group
    // XXX: dont run this yet, more thinking to do
    // await Promise.all(groups.map(async group => {
    //   // Check if group already has the home tag
    //   const existingGroupTag = await GroupTag
    //     .where({
    //       group_id: group.id,
    //       tag_id: homeTag.get('id')
    //     })
    //     .fetch({ transacting })
    //     .catch(() => null)

    //   if (!existingGroupTag) {
    //     await GroupTag.create({
    //       updated_at: new Date(),
    //       group_id: group.id,
    //       tag_id: homeTag.get('id'),
    //       user_id: group.created_by_id || User.AXOLOTL_ID,
    //       is_default: true
    //     }, { transacting })
    //   }

    //   // Update context widgets with title 'widget-hearth' to use home tag id
    //   await knex('context_widgets')
    //     .where({
    //       group_id: group.id,
    //       title: 'widget-hearth'
    //     })
    //     .update({
    //       view_chat_id: homeTag.get('id'),
    //       title: null
    //     })
    //     .transacting(transacting)
    // }))
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
}
