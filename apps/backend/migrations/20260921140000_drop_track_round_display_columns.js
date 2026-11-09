/**
 * Drop track and funding-round display columns. Reads live on the space group
 * (groups.name / banner_url / description, welcome view page_content).
 *
 * down() restores the columns from that space-group data so the migration is reversible.
 */

exports.up = async function (knex) {
  await knex.schema.table('funding_rounds', table => {
    table.dropColumn('title')
    table.dropColumn('banner_url')
    table.dropColumn('description')
  })

  await knex.schema.table('tracks', table => {
    table.dropColumn('name')
    table.dropColumn('description')
    table.dropColumn('banner_url')
    table.dropColumn('welcome_message')
  })
}

exports.down = async function (knex) {
  await knex.schema.table('funding_rounds', table => {
    table.string('title')
    table.text('banner_url')
    table.text('description')
  })

  await knex.schema.table('tracks', table => {
    table.string('name')
    table.text('description')
    table.text('banner_url')
    table.text('welcome_message')
  })

  await knex.raw(`
    UPDATE funding_rounds fr
    SET
      title = COALESCE(g.name, 'Untitled'),
      banner_url = g.banner_url,
      description = g.description
    FROM groups g
    WHERE fr.group_id = g.id
  `)
  await knex.raw(`
    UPDATE funding_rounds
    SET title = COALESCE(title, 'Untitled')
    WHERE title IS NULL
  `)

  await knex.raw(`
    UPDATE tracks t
    SET
      name = COALESCE(g.name, 'Untitled'),
      description = g.description,
      banner_url = g.banner_url
    FROM groups g
    WHERE t.group_id = g.id
  `)
  await knex.raw(`
    UPDATE tracks t
    SET welcome_message = gv.page_content
    FROM group_views gv
    WHERE gv.group_id = t.group_id
      AND gv.type = 'welcome'
  `)
  await knex.raw(`
    UPDATE tracks
    SET name = COALESCE(name, 'Untitled')
    WHERE name IS NULL
  `)

  await knex.raw('ALTER TABLE funding_rounds ALTER COLUMN title SET NOT NULL')
  await knex.raw('ALTER TABLE tracks ALTER COLUMN name SET NOT NULL')
}
