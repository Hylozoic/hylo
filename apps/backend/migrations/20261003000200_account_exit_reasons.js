/**
 * account_exit_reasons keeps the optional answer people give when they
 * deactivate or delete their account. Deletions keep no user id, so the answer
 * can't be traced back to the person.
 */

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS account_exit_reasons (
      id bigserial PRIMARY KEY,
      kind character varying(16) NOT NULL,
      reason character varying(64) NOT NULL,
      user_id bigint
        CONSTRAINT account_exit_reasons_user_id_foreign REFERENCES users(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
      created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
      CONSTRAINT account_exit_reasons_kind_check CHECK (kind IN ('deactivated', 'deleted')),
      CONSTRAINT account_exit_reasons_deleted_has_no_user CHECK (kind <> 'deleted' OR user_id IS NULL)
    )
  `)
}

exports.down = async function (knex) {
  await knex.raw('DROP TABLE IF EXISTS account_exit_reasons')
}
