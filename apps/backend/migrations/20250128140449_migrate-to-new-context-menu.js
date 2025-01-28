/* globals Group */
require("@babel/register")
const models = require('../api/models')

exports.up = async function(knex) {
  models.init()

  // Find all groups that don't have context widgets
  const groupsWithoutWidgets = await knex.raw(`
    SELECT g.id 
    FROM groups g
    LEFT JOIN context_widgets cw ON cw.group_id = g.id
    WHERE cw.id IS NULL
  `)

  const groupIds = groupsWithoutWidgets.rows.map(row => row.id)
  console.log(groupIds.length, 'many groups to make widgets for')
  // Process each group in its own transaction
  return Promise.all(groupIds.map(async groupId => {
    return bookshelf.transaction(async trx => {
      const group = await Group.find(groupId)
      if (group) {
        await group.setupContextWidgets(trx)
        await group.transitionToNewMenu(trx)
      }
    })
  }))
};

exports.down = function(knex) {
  return knex('context_widgets').del();
};
