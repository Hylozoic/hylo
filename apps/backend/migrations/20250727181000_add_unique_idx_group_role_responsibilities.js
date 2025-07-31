exports.up = async function (knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'grr_unique'
      ) THEN
        ALTER TABLE group_roles_responsibilities
          ADD CONSTRAINT grr_unique UNIQUE (group_role_id, responsibility_id);
      END IF;
    END$$;
  `)
}

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE group_roles_responsibilities DROP CONSTRAINT IF EXISTS grr_unique;')
} 