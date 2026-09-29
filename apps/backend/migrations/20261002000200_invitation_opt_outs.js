/**
 * Addresses that asked for no more invitations, stored lowercased, one row
 * each. invitation_id is the invitation whose email link they used.
 */

exports.up = async function (knex) {
  if (!await knex.schema.hasTable('invitation_opt_outs')) {
    await knex.schema.createTable('invitation_opt_outs', table => {
      table.bigIncrements('id')
      table.text('email').notNullable()
      table.bigInteger('invitation_id').references('id').inTable('group_invites').onDelete('SET NULL')
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.unique(['email'])
    })
  }
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invitation_opt_outs_email_lowercase') THEN
        ALTER TABLE invitation_opt_outs
        ADD CONSTRAINT invitation_opt_outs_email_lowercase CHECK (email = lower(email));
      END IF;
    END $$
  `)
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('invitation_opt_outs')
}
