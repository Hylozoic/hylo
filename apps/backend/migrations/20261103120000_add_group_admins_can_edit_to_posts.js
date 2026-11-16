// Lets a post's creator allow content managers of the post's single group to edit it (#1727)
exports.up = async function (knex) {
  await knex.schema.alterTable('posts', table => {
    table.boolean('group_admins_can_edit').defaultTo(false)
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('posts', table => {
    table.dropColumn('group_admins_can_edit')
  })
}
