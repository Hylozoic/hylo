exports.up = async function (knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'gmgr_unique'
      ) THEN
        ALTER TABLE group_memberships_group_roles
          ADD CONSTRAINT gmgr_unique UNIQUE (group_id, group_role_id, user_id);
      END IF;
    END$$;
  `)
}

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE group_memberships_group_roles DROP CONSTRAINT IF EXISTS gmgr_unique;')
} 