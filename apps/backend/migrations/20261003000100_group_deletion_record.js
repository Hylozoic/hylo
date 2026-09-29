/**
 * group_deletions records what deleting a group took away (its memberships and
 * its spaces', its role assignments and accepted agreements), so Hylo staff can
 * restore the group and exactly those memberships for 30 days.
 */

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS group_deletions (
      id bigserial PRIMARY KEY,
      group_id bigint NOT NULL
        CONSTRAINT group_deletions_group_id_foreign REFERENCES groups(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
      deleted_by_id bigint
        CONSTRAINT group_deletions_deleted_by_id_foreign REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
      memberships jsonb DEFAULT '[]'::jsonb NOT NULL,
      role_assignments jsonb DEFAULT '[]'::jsonb NOT NULL,
      accepted_agreement_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
      restorable_until timestamp with time zone NOT NULL,
      restored_at timestamp with time zone,
      restored_by_id bigint
        CONSTRAINT group_deletions_restored_by_id_foreign REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
      created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `)
  await knex.raw('CREATE INDEX IF NOT EXISTS group_deletions_group_id_index ON group_deletions (group_id)')
}

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS group_deletions')
}
