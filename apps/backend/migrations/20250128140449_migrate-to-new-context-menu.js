// XXX: dont run this yet until it handles existing custom views and external links better

exports.up = function (knex) {
  console.log('New context menu migration is a noop for now')
  return Promise.resolve()
}

exports.down = function (knex) {
  return Promise.resolve()
}
