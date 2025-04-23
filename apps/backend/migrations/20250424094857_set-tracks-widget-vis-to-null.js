exports.up = function (knex) {
  return knex('context_widgets')
    .where('type', 'tracks')
    .update({
      visibility: null
    })
}

exports.down = function (knex) {
  return knex('context_widgets')
    .where('type', 'tracks')
    .update({
      visibility: 'admin'
    })
}
