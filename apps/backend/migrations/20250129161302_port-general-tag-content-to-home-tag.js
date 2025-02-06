exports.up = function(knex) {
  // These model-based migrations failed outside of local development and have been abandoned
  return Promise.resolve()
};

exports.down = function(knex) {
  return Promise.resolve()
};
