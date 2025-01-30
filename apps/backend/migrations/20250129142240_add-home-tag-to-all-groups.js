exports.up = async function(knex) {
  return knex.raw(`
    WITH new_home_tag AS (
      INSERT INTO tags (name, created_at, updated_at)
      SELECT 'home', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1 FROM tags WHERE name = 'home'
      )
      RETURNING id
    )
    SELECT COALESCE(
      (SELECT id FROM new_home_tag),
      (SELECT id FROM tags WHERE name = 'home')
    ) as home_tag_id;
  `)
}

exports.down = async function(knex) {
  return knex.raw(`
    DELETE FROM groups_tags
    WHERE tag_id = (
      SELECT id FROM tags WHERE name = 'home'
    );
  `)
}
