exports.up = async function (knex) {
  await knex.schema.alterTable('group_memberships', table => {
    table.index(['user_id', 'active'], 'group_memberships_user_id_active_index')
  })

  await knex.schema.alterTable('group_relationships', table => {
    table.index(['parent_group_id', 'active'], 'group_relationships_parent_group_id_active_index')
    table.index(['child_group_id', 'active'], 'group_relationships_child_group_id_active_index')
  })

  await knex.schema.alterTable('groups', table => {
    table.dropIndex('visibility')
    table.index(['visibility', 'active'], 'groups_visibility_active_index')
  })

  await knex.schema.alterTable('common_roles_responsibilities', table => {
    table.index(['responsibility_id'], 'common_roles_responsibilities_responsibility_id_index')
  })

  await knex.schema.alterTable('group_roles_responsibilities', table => {
    table.index(['responsibility_id'], 'group_roles_responsibilities_responsibility_id_index')
  })

  await knex.schema.alterTable('group_memberships_common_roles', table => {
    table.dropIndex('group_id_user_id') // Drop old index, this new one should be more useful
    table.index(['user_id', 'group_id'], 'group_memberships_common_roles_user_id_group_id_index')
  })

  await knex.raw('drop index if exists members_roles_group_id_user_id_index') // Drop old index, this new one should be more useful
  await knex.schema.alterTable('group_memberships_group_roles', table => {
    table.index(['user_id', 'group_id'], 'group_memberships_group_roles_user_id_group_id_index')
  })

  await knex.schema.alterTable('blocked_users', table => {
    table.index(['user_id'], 'blocked_users_user_id_index')
    table.index(['blocked_user_id'], 'blocked_users_blocked_user_id_index')
  })

  await knex.schema.alterTable('user_connections', table => {
    table.index(['user_id'], 'user_connections_user_id_index')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('group_memberships', table => {
    table.dropIndex('user_id_active')
  })

  await knex.schema.alterTable('group_relationships', table => {
    table.dropIndex('parent_group_id_active')
    table.dropIndex('child_group_id_active')
  })

  await knex.schema.alterTable('groups', table => {
    table.dropIndex('visibility_active')
    table.index(['visibility'], 'groups_visibility_index')
  })

  await knex.schema.alterTable('common_roles_responsibilities', table => {
    table.dropIndex('responsibility_id')
  })

  await knex.schema.alterTable('group_roles_responsibilities', table => {
    table.dropIndex('responsibility_id')
  })

  await knex.schema.alterTable('group_memberships_common_roles', table => {
    table.dropIndex('user_id_group_id')
    table.index(['group_id', 'user_id'], 'group_memberships_common_roles_group_id_user_id_index')
  })

  await knex.schema.alterTable('group_memberships_group_roles', table => {
    table.dropIndex('user_id_group_id')
    table.index(['group_id', 'user_id'], 'members_roles_group_id_user_id_index')
  })

  await knex.schema.alterTable('blocked_users', table => {
    table.dropIndex('user_id')
    table.dropIndex('blocked_user_id')
  })

  await knex.schema.alterTable('user_connections', table => {
    table.dropIndex('user_id')
  })
}
