/**
 * What each member with limited invite access submitted: one row per address
 * they typed, or per person they picked, whether or not an invitation was
 * created for it. invitation_id links the invitation when one was. Their
 * "Your pending invites" list shows these rows, all in the same way, until
 * they age out or the member cancels one (hidden_at). Members' invitations
 * that are still pending from the last 14 days get a row too, dated when they
 * were sent.
 */

exports.up = async function (knex) {
  if (!await knex.schema.hasTable('invitation_submissions')) {
    await knex.schema.createTable('invitation_submissions', table => {
      table.bigIncrements('id')
      table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
      table.text('email')
      table.bigInteger('invitee_id').references('id').inTable('users').onDelete('CASCADE')
      table.bigInteger('invitation_id').references('id').inTable('group_invites').onDelete('SET NULL')
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.timestamp('hidden_at')
      table.index(['user_id', 'group_id', 'created_at'])
    })
  }
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invitation_submissions_email_or_invitee') THEN
        ALTER TABLE invitation_submissions
        ADD CONSTRAINT invitation_submissions_email_or_invitee CHECK (email IS NOT NULL OR invitee_id IS NOT NULL);
      END IF;
    END $$
  `)
  // Members' pending invitations from before this list existed, so they can still see and cancel them
  await knex.raw(`
    INSERT INTO invitation_submissions (user_id, group_id, email, invitation_id, created_at)
    SELECT gi.invited_by_id, gi.group_id, lower(gi.email), gi.id, gi.created_at
    FROM group_invites gi
    WHERE gi.inviter_access = 'limited'
      AND gi.used_by_id IS NULL
      AND gi.expired_by_id IS NULL
      AND gi.created_at > now() - interval '14 days'
      AND NOT EXISTS (SELECT 1 FROM invitation_submissions s WHERE s.invitation_id = gi.id)
  `)
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('invitation_submissions')
}
