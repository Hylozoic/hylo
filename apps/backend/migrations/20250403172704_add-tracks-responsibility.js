exports.up = async function (knex) {
  const [responsibility] = await knex('responsibilities').insert({
    title: 'Manage Tracks',
    description: 'The ability to create, edit, and delete tracks.',
    type: 'system'
  }).returning('*')

  await knex('common_roles_responsibilities').insert({
    common_role_id: 1, // Coordinator
    responsibility_id: responsibility.id
  })
}

exports.down = async function (knex) {
  const responsibility = await knex('responsibilities').where('title', 'Manage Tracks').first()
  await knex('common_roles_responsibilities').where('responsibility_id', responsibility.id).delete()
  await knex('responsibilities').where('title', 'Manage Tracks').delete()
}
