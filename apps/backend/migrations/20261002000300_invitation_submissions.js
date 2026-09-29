/**
 * What each member with limited invite access submitted: one row per address
 * they typed, or per person they picked, whether or not an invitation was
 * created for it. invitation_id links the invitation when one was. Their
 * "Your pending invites" list shows these rows, all in the same way, until
 * they age out or the member cancels one (hidden_at).
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
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('invitation_submissions')
}
