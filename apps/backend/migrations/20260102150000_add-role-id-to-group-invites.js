/**
 * Add role columns to group_invites table
 *
 * This allows email invitations to specify roles that will be
 * assigned to the user when they join the group via the invitation.
 *
 * - common_role_id: References common_roles table (Coordinator=1, Moderator=2, Host=3)
 * - group_role_id: References groups_roles table (group-specific custom roles)
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('group_invites', table => {
    table.bigInteger('common_role_id').references('id').inTable('common_roles')
    table.bigInteger('group_role_id').references('id').inTable('groups_roles')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('group_invites', table => {
    table.dropColumn('common_role_id')
    table.dropColumn('group_role_id')
  })
}
