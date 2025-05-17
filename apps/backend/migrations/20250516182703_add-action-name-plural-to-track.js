exports.up = async function (knex) {
  await knex.schema.table('tracks', table => {
    table.renameColumn('actions_name', 'action_descriptor_plural')
    table.string('action_descriptor')
  })

  await knex.raw(`
    UPDATE tracks
    SET action_descriptor = 'Action', action_descriptor_plural = 'Actions'
  `)
}

exports.down = async function (knex) {
  await knex.schema.table('tracks', table => {
    table.renameColumn('action_descriptor_plural', 'actions_name')
    table.dropColumn('action_descriptor')
  })
}
