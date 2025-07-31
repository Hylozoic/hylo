exports.up = async function (knex) {
  // Get all self-stewarded groups that have bootstrap roles
  const groupsWithBootstrapRoles = await knex.raw(`
    SELECT DISTINCT g.id, g.name, g.slug
    FROM groups g
    INNER JOIN groups_roles gr ON g.id = gr.group_id
    WHERE g.mode = 'self_stewarded'
    AND gr.bootstrap = true
    AND gr.name = 'Coordinator'
  `)

  for (const group of groupsWithBootstrapRoles.rows) {
    // Create new responsibility-based roles
    const responsibilities = [
      { name: 'Administration', description: 'Overall group administration and settings', responsibilityId: 1 },
      { name: 'Add Members', description: 'Invite and approve new members', responsibilityId: 2 },
      { name: 'Remove Members', description: 'Remove members and manage membership', responsibilityId: 3 },
      { name: 'Manage Content', description: 'Moderate posts, comments, and content', responsibilityId: 4 }
    ]

    for (const resp of responsibilities) {
      // Check if role already exists
      const existingRole = await knex('groups_roles')
        .where({ group_id: group.id, name: resp.name })
        .first()

      if (!existingRole) {
        // Create new role
        const [roleId] = await knex('groups_roles').insert({
          group_id: group.id,
          name: resp.name,
          description: resp.description,
          assignment: 'trust',
          status: 'vacant',
          threshold_current: 0,
          threshold_required: 5,
          bootstrap: true,
          created_at: new Date(),
          updated_at: new Date()
        }).returning('id')

        // Attach responsibility
        await knex('group_roles_responsibilities').insert({
          group_role_id: roleId,
          responsibility_id: resp.responsibilityId
        })

        // If this is Administration role, copy stewards from old Coordinator role
        if (resp.name === 'Administration') {
          const coordinatorRole = await knex('groups_roles')
            .where({ group_id: group.id, name: 'Coordinator' })
            .first()

          if (coordinatorRole) {
            // Copy stewards from Coordinator to Administration
            const stewards = await knex('group_roles_users')
              .where({ group_role_id: coordinatorRole.id })
              .select('user_id')

            for (const steward of stewards) {
              await knex('group_roles_users').insert({
                group_role_id: roleId,
                user_id: steward.user_id,
                created_at: new Date(),
                updated_at: new Date()
              })
            }

            // Update status to active if there are stewards
            if (stewards.length > 0) {
              await knex('groups_roles')
                .where({ id: roleId })
                .update({ status: 'active', threshold_current: stewards.length })
            }
          }
        }
      }
    }

    // Now safely remove the old Coordinator role and its dependencies
    const coordinatorRole = await knex('groups_roles')
      .where({ group_id: group.id, name: 'Coordinator' })
      .first()

    if (coordinatorRole) {
      // First, delete role assignments
      await knex('group_roles_users')
        .where({ group_role_id: coordinatorRole.id })
        .del()

      // Delete role responsibilities
      await knex('group_roles_responsibilities')
        .where({ group_role_id: coordinatorRole.id })
        .del()

      // Delete any trust expressions
      await knex('trust_expressions')
        .where({ group_role_id: coordinatorRole.id })
        .del()

      // Finally, delete the role itself
      await knex('groups_roles')
        .where({ id: coordinatorRole.id })
        .del()
    }
  }
}

exports.down = async function (knex) {
  // This migration is not easily reversible
  // We would need to recreate the Coordinator roles and merge the responsibility roles
  console.log('Migration down not implemented - would require complex role merging logic')
}
// End of migration