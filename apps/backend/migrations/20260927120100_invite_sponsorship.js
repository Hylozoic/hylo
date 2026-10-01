/**
 * Record who could send each invitation, and keep a ledger of member-sent
 * invitations:
 * - group_invites.inviter_access: 'full' (Add Members) or 'limited' (Invite
 *   Members). Existing rows read as 'full', so their behaviour is unchanged.
 * - join_requests.invitation_id: the member invitation a join request came from.
 * - invitation_sends: one row per member send, counting every valid address
 *   submitted, for the daily invitation allowance.
 *
 * down() expires pending 'limited' invitations before dropping the column, so
 * none of them turns into a steward invitation.
 */

exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE group_invites
    ADD COLUMN IF NOT EXISTS inviter_access character varying(16) DEFAULT 'full' NOT NULL
  `)
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_invites_inviter_access_check') THEN
        ALTER TABLE group_invites
        ADD CONSTRAINT group_invites_inviter_access_check
        CHECK (inviter_access::text IN ('full', 'limited')) NOT VALID;
      END IF;
    END $$
  `)
  await knex.raw('ALTER TABLE group_invites VALIDATE CONSTRAINT group_invites_inviter_access_check')

  await knex.raw('ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS invitation_id bigint')
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'join_requests_invitation_id_foreign') THEN
        ALTER TABLE join_requests
        ADD CONSTRAINT join_requests_invitation_id_foreign
        FOREIGN KEY (invitation_id) REFERENCES group_invites(id) ON DELETE SET NULL NOT VALID;
      END IF;
    END $$
  `)
  await knex.raw('ALTER TABLE join_requests VALIDATE CONSTRAINT join_requests_invitation_id_foreign')
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS join_requests_invitation_id_index
    ON join_requests (invitation_id) WHERE invitation_id IS NOT NULL
  `)

  if (!await knex.schema.hasTable('invitation_sends')) {
    await knex.schema.createTable('invitation_sends', table => {
      table.bigIncrements('id')
      table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
      table.integer('recipients').notNullable()
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.index(['user_id', 'created_at'])
      table.index(['group_id', 'created_at'])
    })
  }
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('invitation_sends')

  await knex.raw('DROP INDEX IF EXISTS join_requests_invitation_id_index')
  await knex.raw('ALTER TABLE join_requests DROP CONSTRAINT IF EXISTS join_requests_invitation_id_foreign')
  await knex.raw('ALTER TABLE join_requests DROP COLUMN IF EXISTS invitation_id')

  const hasInviterAccess = await knex.schema.hasColumn('group_invites', 'inviter_access')
  if (hasInviterAccess) {
    await knex('group_invites')
      .where('inviter_access', 'limited')
      .whereNull('used_by_id')
      .whereNull('expired_by_id')
      .update({ expired_by_id: knex.raw('invited_by_id'), expired_at: new Date() })
  }
  await knex.raw('ALTER TABLE group_invites DROP CONSTRAINT IF EXISTS group_invites_inviter_access_check')
  await knex.raw('ALTER TABLE group_invites DROP COLUMN IF EXISTS inviter_access')
}
