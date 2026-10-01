/**
 * join_requests.member_invite_link_id: the member invite link a join request
 * came from, so stewards see who invited the person. invitation_id already
 * covers requests that came from a member's email invitation.
 */

exports.up = async function (knex) {
  await knex.raw('ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS member_invite_link_id bigint')
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'join_requests_member_invite_link_id_foreign') THEN
        ALTER TABLE join_requests
        ADD CONSTRAINT join_requests_member_invite_link_id_foreign
        FOREIGN KEY (member_invite_link_id) REFERENCES member_invite_links(id) ON DELETE SET NULL NOT VALID;
      END IF;
    END $$
  `)
  await knex.raw('ALTER TABLE join_requests VALIDATE CONSTRAINT join_requests_member_invite_link_id_foreign')
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS join_requests_member_invite_link_id_index
    ON join_requests (member_invite_link_id) WHERE member_invite_link_id IS NOT NULL
  `)
}

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS join_requests_member_invite_link_id_index')
  await knex.raw('ALTER TABLE join_requests DROP CONSTRAINT IF EXISTS join_requests_member_invite_link_id_foreign')
  await knex.raw('ALTER TABLE join_requests DROP COLUMN IF EXISTS member_invite_link_id')
}
