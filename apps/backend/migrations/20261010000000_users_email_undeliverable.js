/**
 * Marks an address the email provider reported as undeliverable (a hard bounce, or a
 * send dropped because the address bounced before). Hylo then stops non-essential email
 * to it and asks the person to fix it; essential email is still attempted. Cleared when
 * the address changes or is verified again.
 */

exports.up = async function up (knex) {
  const hasAt = await knex.schema.hasColumn('users', 'email_undeliverable_at')
  const hasReason = await knex.schema.hasColumn('users', 'email_undeliverable_reason')
  await knex.schema.alterTable('users', table => {
    if (!hasAt) table.timestamp('email_undeliverable_at', { useTz: true }).nullable()
    if (!hasReason) table.string('email_undeliverable_reason', 255).nullable()
  })

  await knex.raw(`
    COMMENT ON COLUMN users.email_undeliverable_at IS 'When the email provider last reported this address as undeliverable; cleared when the address changes or is verified';
    COMMENT ON COLUMN users.email_undeliverable_reason IS 'What the provider reported, for example a bounce and its classification';
  `)
}

exports.down = async function down (knex) {
  await knex.schema.alterTable('users', table => {
    table.dropColumn('email_undeliverable_reason')
    table.dropColumn('email_undeliverable_at')
  })
}
