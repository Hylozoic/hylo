exports.up = function(knex) {
  return knex.schema.alterTable('proposal_votes', table => {
    table.unique(['option_id', 'user_id'], 'unique_proposal_vote_per_user')
  })
}

exports.down = function(knex) {
  return knex.schema.alterTable('proposal_votes', table => {
    table.dropUnique(['option_id', 'user_id'], 'unique_proposal_vote_per_user')
  })
}
