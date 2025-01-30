/* globals Group  */
require("@babel/register")
const models = require('../api/models')

exports.up = async function(knex) {
  models.init()

  // Find all groups that don't have context widgets
  const groups = await knex.raw(`
    SELECT g.id
    FROM groups g
  `)
  const groupIds = groups.rows.map(row => row.id)
  console.log('Number of updated groups', groupIds.length)
  // Process each group in its own transaction
  return Promise.all(groupIds.map(async groupId => {
    return bookshelf.transaction(async trx => {
      const group = await Group.find(groupId)
      if (group) {
        await group.transitionToNewMenu(trx)
      }
    })
  }))
};

exports.down = function(knex) {
  
};
