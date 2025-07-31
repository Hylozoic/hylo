exports.up = async function (knex) {
  // Add mode column to groups
  await knex.schema.alterTable('groups', table => {
    table.string('mode').defaultTo('admined').notNullable().index()
  })

  // Add assignment and trust-related columns to groups_roles
  await knex.schema.alterTable('groups_roles', table => {
    table.string('assignment').defaultTo('admin').notNullable().index()
    table.string('status').defaultTo('vacant').notNullable().index()
    table.integer('threshold_current').defaultTo(0)
    table.integer('threshold_required').defaultTo(0)
    table.boolean('bootstrap').defaultTo(false)
  })

  // Group roles users junction table for stewards
  await knex.schema.createTable('group_roles_users', table => {
    table.bigInteger('group_role_id').references('id').inTable('groups_roles').notNullable()
    table.bigInteger('user_id').references('id').inTable('users').notNullable()
    table.timestamp('created_at')
    table.timestamp('updated_at')

    table.primary(['group_role_id', 'user_id'])
    table.index(['group_role_id'], 'group_roles_users_role_idx')
    table.index(['user_id'], 'group_roles_users_user_idx')
  })

  // Trust expressions capture per-member trust votes for a role within a group
  await knex.schema.createTable('trust_expressions', table => {
    table.increments().primary()
    table.bigInteger('group_id').references('id').inTable('groups').notNullable()
    table.bigInteger('group_role_id').references('id').inTable('groups_roles').notNullable()
    table.bigInteger('trustor_id').references('id').inTable('users').notNullable()
    table.bigInteger('trustee_id').references('id').inTable('users').notNullable()
    table.integer('value').notNullable()
    table.timestamp('created_at')
    table.timestamp('updated_at')

    table.unique(['group_role_id', 'trustor_id', 'trustee_id'], 'trust_expressions_unique_vote')
    table.index(['group_id', 'group_role_id'], 'trust_expressions_group_role_idx')
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('trust_expressions')
  await knex.schema.dropTableIfExists('group_roles_users')

  // Check if columns exist before dropping them
  const hasAssignment = await knex.schema.hasColumn('groups_roles', 'assignment')
  const hasStatus = await knex.schema.hasColumn('groups_roles', 'status')
  const hasThresholdCurrent = await knex.schema.hasColumn('groups_roles', 'threshold_current')
  const hasThresholdRequired = await knex.schema.hasColumn('groups_roles', 'threshold_required')
  const hasBootstrap = await knex.schema.hasColumn('groups_roles', 'bootstrap')
  const hasMode = await knex.schema.hasColumn('groups', 'mode')

  if (hasAssignment || hasStatus || hasThresholdCurrent || hasThresholdRequired || hasBootstrap) {
    await knex.schema.alterTable('groups_roles', table => {
      if (hasAssignment) table.dropColumn('assignment')
      if (hasStatus) table.dropColumn('status')
      if (hasThresholdCurrent) table.dropColumn('threshold_current')
      if (hasThresholdRequired) table.dropColumn('threshold_required')
      if (hasBootstrap) table.dropColumn('bootstrap')
    })
  }

  if (hasMode) {
    await knex.schema.alterTable('groups', table => {
      table.dropColumn('mode')
    })
  }
}
