// XXX: dont run this yet until it handles existing custom views and external links better

exports.up = function(knex) {
  console.log("These model-based migrations failed outside of local development and have been abandoned")
  return Promise.resolve()
}

exports.down = function (knex) {
  return Promise.resolve()
}
