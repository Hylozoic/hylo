exports.up = async function (knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'trust_expressions_unique_vote'
      ) THEN
        ALTER TABLE trust_expressions
          ADD CONSTRAINT trust_expressions_unique_vote UNIQUE (group_id, group_role_id, trustor_id, trustee_id);
      END IF;
    END$$;
  `)
}

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE trust_expressions DROP CONSTRAINT IF EXISTS trust_expressions_unique_vote;')
} 