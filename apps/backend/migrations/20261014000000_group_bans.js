/**
 * People a steward removed from a group and blocked from rejoining it. The
 * block lasts until a steward lifts it (lifted_at, lifted_by_id), so the rows
 * also record who was blocked, by whom and when. At most one block in force
 * per person and group.
 */

exports.up = async function (knex) {
  if (!await knex.schema.hasTable('group_bans')) {
    await knex.schema.createTable('group_bans', table => {
      table.bigIncrements('id')
      table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
      table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.bigInteger('created_by_id').references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.timestamp('lifted_at')
      table.bigInteger('lifted_by_id').references('id').inTable('users').onDelete('SET NULL')
      table.index(['user_id'])
    })
  }
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS group_bans_one_active
    ON group_bans (group_id, user_id) WHERE lifted_at IS NULL
  `)
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('group_bans')
}
