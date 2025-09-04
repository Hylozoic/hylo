exports.up = async function (knex) {
  const [responsibility] = await knex('responsibilities').insert({
    title: 'Manage Rounds',
    description: 'The ability to create, edit, and delete funding rounds.',
    type: 'system'
  }).returning('*')

  // Coordinator common role appears to be id 1 in prior migrations
  await knex('common_roles_responsibilities').insert({
    common_role_id: 1,
    responsibility_id: responsibility.id
  })
}

exports.down = async function (knex) {
  const responsibility = await knex('responsibilities').where('title', 'Manage Rounds').first()
  if (responsibility) {
    await knex('common_roles_responsibilities').where('responsibility_id', responsibility.id).delete()
    await knex('responsibilities').where('id', responsibility.id).delete()
  }
}


