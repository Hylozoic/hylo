/**
 * Replace the single groups.access_code join link with one row per link, and
 * keep a ledger of invitation sends for the daily allowance:
 * - group_invite_links: reusable links. grant_access lets the person join
 *   regardless of the group's accessibility. granted_roles is role ids assigned
 *   on join. deleted_at soft-deletes a link.
 * - groups.lift_admin_invite_limits: when true, Administrators of that group
 *   are not held to the daily invitation allowance. No UI sets this yet.
 * - invitation_sends: one row per send, counting every address submitted.
 *
 * Existing groups.access_code values become one link each, with grant_access
 * true. The column itself stays, unused, until a later migration drops it.
 * group_memberships.group_invite_link_id records which link a person joined
 * through. It is left null for joins that did not use a link.
 */

exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE groups
    ADD COLUMN IF NOT EXISTS lift_admin_invite_limits boolean NOT NULL DEFAULT false
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

  if (!await knex.schema.hasTable('group_invite_links')) {
    await knex.schema.createTable('group_invite_links', table => {
      table.bigIncrements('id')
      table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
      table.string('access_code', 255).notNullable()
      table.string('name', 255).nullable()
      table.boolean('grant_access').notNullable().defaultTo(true)
      table.jsonb('granted_roles').notNullable().defaultTo(knex.raw("'[]'::jsonb"))
      table.integer('num_joined_users').notNullable().defaultTo(0)
      table.bigInteger('created_by_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.timestamp('deleted_at').nullable()
      table.bigInteger('deleted_by_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.index(['group_id'])
    })
  }

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS group_invite_links_access_code_unique
    ON group_invite_links (lower(access_code))
  `)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS group_invite_links_group_id_active
    ON group_invite_links (group_id) WHERE deleted_at IS NULL
  `)

  await knex.raw(`
    ALTER TABLE group_memberships
    ADD COLUMN IF NOT EXISTS group_invite_link_id bigint REFERENCES group_invite_links(id) ON DELETE SET NULL
  `)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS group_memberships_group_invite_link_id_index
    ON group_memberships (group_invite_link_id) WHERE group_invite_link_id IS NOT NULL
  `)

  // One link per existing code. Duplicate codes (there is no unique constraint
  // on groups.access_code) keep the oldest group's code.
  await knex.raw(`
    INSERT INTO group_invite_links (
      group_id, access_code, grant_access, granted_roles, num_joined_users, created_by_id, created_at
    )
    SELECT DISTINCT ON (lower(g.access_code))
      g.id, g.access_code, true, '[]'::jsonb, 0, g.created_by_id, COALESCE(g.created_at, now())
    FROM groups g
    WHERE g.access_code IS NOT NULL AND btrim(g.access_code) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM group_invite_links l WHERE lower(l.access_code) = lower(g.access_code)
      )
    ORDER BY lower(g.access_code), g.id
  `)
}

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS group_memberships_group_invite_link_id_index')
  await knex.raw('ALTER TABLE group_memberships DROP COLUMN IF EXISTS group_invite_link_id')
  await knex.raw('DROP INDEX IF EXISTS group_invite_links_access_code_unique')
  await knex.raw('DROP INDEX IF EXISTS group_invite_links_group_id_active')
  await knex.schema.dropTableIfExists('group_invite_links')
  await knex.schema.dropTableIfExists('invitation_sends')
  await knex.raw('ALTER TABLE groups DROP COLUMN IF EXISTS lift_admin_invite_limits')
}
