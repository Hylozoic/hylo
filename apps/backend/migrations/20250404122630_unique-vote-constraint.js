exports.up = function (knex) {
  return knex.raw(`
    -- Delete duplicate votes keeping only the most recent vote per user per option
    DELETE FROM proposal_votes
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY option_id, user_id
          ORDER BY created_at DESC, id DESC
        ) as rnum
        FROM proposal_votes
      ) t
      WHERE t.rnum > 1
    );
  `)
    .then(() => {
      return knex.schema.alterTable('proposal_votes', table => {
        table.unique(['option_id', 'user_id'], 'unique_proposal_vote_per_user')
      })
    })
}

exports.down = function (knex) {
  return knex.schema.alterTable('proposal_votes', table => {
    table.dropUnique(['option_id', 'user_id'], 'unique_proposal_vote_per_user')
  })
}
