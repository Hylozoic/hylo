/* globals Group, Tag */
  // XXX: dont run this yet until it handles existing custom views and external links better
// require("@babel/register")
// const models = require('../api/models')

exports.up = function(knex) {
  console.log("These model-based migrations failed outside of local development and have been abandoned")
  return Promise.resolve()
  // models.init()

  // let homeTag = await Tag.where({ name: 'home' }).fetch({ transacting })
  // if (!homeTag) {
  //   homeTag = await Tag.forge({
  //     name: 'home',
  //     created_at: new Date(),
  //     updated_at: new Date()
  //   }).save(null, { transacting })
  // }

  // // Find all groups that don't have context widgets
  // const groupsWithoutWidgets = await knex.raw(`
  //   SELECT g.id
  //   FROM groups g
  //   LEFT JOIN context_widgets cw ON cw.group_id = g.id
  //   WHERE cw.id IS NULL
  // `)

  // const groupIds = groupsWithoutWidgets.rows.map(row => row.id)
  // console.log(groupIds.length, 'many groups to make widgets for')
  // // Process each group in its own transaction
  // return Promise.all(groupIds.map(async groupId => {
  //   return bookshelf.transaction(async trx => {
  //     const group = await Group.find(groupId)
  //     if (group) {
  //       await group.setupContextWidgets(trx)
  //       await group.transitionToNewMenu(trx)
  //     }
  //   })
  // }))
};

exports.down = function(knex) {
  //return knex('context_widgets').del();
  return Promise.resolve()
};
