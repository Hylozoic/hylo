/**
 * Personal invite links for members with limited invite access: one active
 * link per member and top-level group. Resetting a link revokes it and adds a
 * new row, so revoked codes never work again. Codes are unique whatever their
 * case, as group join link codes are looked up without case.
 */

exports.up = async function (knex) {
  if (!await knex.schema.hasTable('member_invite_links')) {
    await knex.schema.createTable('member_invite_links', table => {
      table.bigIncrements('id')
      table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
      table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('code', 32).notNullable()
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.timestamp('revoked_at')
      table.index(['user_id'])
    })
  }
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS member_invite_links_code_unique
    ON member_invite_links (lower(code))
  `)
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS member_invite_links_one_active
    ON member_invite_links (group_id, user_id) WHERE revoked_at IS NULL
  `)
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('member_invite_links')
}
