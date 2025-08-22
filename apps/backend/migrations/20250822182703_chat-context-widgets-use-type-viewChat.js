exports.up = async function (knex) {
  await knex.raw(`
    UPDATE context_widgets
    SET type = 'viewChat'
    WHERE type = 'chat'
  `)
}

exports.down = async function (knex) {
  await knex.raw(`
    UPDATE context_widgets
    SET type = 'chat'
    WHERE type = 'viewChat'
  `)
}
