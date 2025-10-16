exports.up = async function (knex) {
  // Add new JSONB columns for multiple roles
  await knex.schema.table('funding_rounds', table => {
    table.jsonb('submitter_roles').defaultTo('[]')
    table.jsonb('voter_roles').defaultTo('[]')
  })

  // Migrate existing single role data to array format
  const existingRounds = await knex('funding_rounds').select('id', 'submitter_role_id', 'submitter_role_type', 'voter_role_id', 'voter_role_type')

  for (const round of existingRounds) {
    const submitterRoles = []
    const voterRoles = []

    // Convert submitter role to array format if it exists
    if (round.submitter_role_id && round.submitter_role_type) {
      submitterRoles.push({
        id: round.submitter_role_id,
        type: round.submitter_role_type
      })
    }

    // Convert voter role to array format if it exists
    if (round.voter_role_id && round.voter_role_type) {
      voterRoles.push({
        id: round.voter_role_id,
        type: round.voter_role_type
      })
    }

    await knex('funding_rounds')
      .where({ id: round.id })
      .update({
        submitter_roles: JSON.stringify(submitterRoles),
        voter_roles: JSON.stringify(voterRoles)
      })
  }

  // Drop old columns
  await knex.schema.table('funding_rounds', table => {
    table.dropColumn('submitter_role_id')
    table.dropColumn('submitter_role_type')
    table.dropColumn('voter_role_id')
    table.dropColumn('voter_role_type')
  })
}

exports.down = async function (knex) {
  // Add back the old columns
  await knex.schema.table('funding_rounds', table => {
    table.bigInteger('submitter_role_id')
    table.string('submitter_role_type')
    table.bigInteger('voter_role_id')
    table.string('voter_role_type')
  })

  // Migrate data back (taking only the first role from each array)
  const existingRounds = await knex('funding_rounds').select('id', 'submitter_roles', 'voter_roles')

  for (const round of existingRounds) {
    const submitterRoles = JSON.parse(round.submitter_roles || '[]')
    const voterRoles = JSON.parse(round.voter_roles || '[]')

    const update = {}

    // Take first submitter role if it exists
    if (submitterRoles.length > 0) {
      update.submitter_role_id = submitterRoles[0].id
      update.submitter_role_type = submitterRoles[0].type
    }

    // Take first voter role if it exists
    if (voterRoles.length > 0) {
      update.voter_role_id = voterRoles[0].id
      update.voter_role_type = voterRoles[0].type
    }

    if (Object.keys(update).length > 0) {
      await knex('funding_rounds')
        .where({ id: round.id })
        .update(update)
    }
  }

  // Drop new columns
  await knex.schema.table('funding_rounds', table => {
    table.dropColumn('submitter_roles')
    table.dropColumn('voter_roles')
  })
}
