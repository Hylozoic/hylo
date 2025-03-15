exports.up = async function (knex) {
  // Turn most recent pinned post description into welcome page
  await knex.raw(`
    UPDATE groups
    SET "welcome_page" = subquery.description
    FROM (
      SELECT DISTINCT ON (gp.group_id)
        gp.group_id,
        p.description
      FROM groups_posts gp
      INNER JOIN posts p ON p.id = gp.post_id
      WHERE gp.pinned_at IS NOT NULL
      AND p.active
      AND p.description IS NOT NULL
      ORDER BY gp.group_id ASC, gp.pinned_at DESC
    ) AS subquery
    WHERE groups.id = subquery.group_id
  `)
}

exports.down = async function (knex) {
  await knex.raw(`
    UPDATE groups
    SET "welcome_page" = NULL
  `)
}
