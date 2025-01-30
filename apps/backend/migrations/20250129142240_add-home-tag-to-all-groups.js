/* globals Tag, GroupTag, User */
require("@babel/register")
const models = require('../api/models')

exports.up = async function(knex) {
  console.log("Add home tag to all groups")
  // models.init()

  console.log("models init")
  // Get all groups and their created_by_id
  // const groups = await knex('groups')
  //   .select(['id', 'created_by_id'])

  // console.log(`Adding home tag to ${groups.length} groups`)

  let homeTag = await knex('tags')
    .where({ name: 'home' })
    .first()
  console.log("home tag", homeTag)
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
    console.log("new tag forged", homeTag)
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
  console.log("add home tag done")
  return Promise.resolve()
}

exports.down = async function(knex, Promise) {
}
