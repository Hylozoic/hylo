exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    // First, get all duplicate tag groups
    const duplicateGroups = await trx.raw(`
      SELECT LOWER(name) as lowercase_name,
             array_agg(id ORDER BY 
               CASE WHEN name = LOWER(name) THEN 0 ELSE 1 END,
               id
             ) as tag_ids,
             array_agg(name) as original_names,
             COUNT(*) as duplicate_count
      FROM tags
      GROUP BY LOWER(name)
      HAVING COUNT(*) > 1
    `)

    // For each group of duplicates
    for (const group of duplicateGroups.rows) {
      const [keepTagId, ...duplicateTagIds] = group.tag_ids

      // Handle posts_tags relationships
      await trx.raw(`
        DELETE FROM posts_tags
        WHERE EXISTS (
          SELECT 1 FROM posts_tags pt2
          WHERE pt2.post_id = posts_tags.post_id
          AND pt2.tag_id = ?
          AND posts_tags.tag_id = ANY(?)
        )
      `, [keepTagId, duplicateTagIds])

      await trx.raw(`
        UPDATE posts_tags
        SET tag_id = ?
        WHERE tag_id = ANY(?)
        AND NOT EXISTS (
          SELECT 1 FROM posts_tags pt2
          WHERE pt2.post_id = posts_tags.post_id
          AND pt2.tag_id = ?
        )
      `, [keepTagId, duplicateTagIds, keepTagId])

      // Handle tag_follows relationships
      await trx.raw(`
        DELETE FROM tag_follows
        WHERE EXISTS (
          SELECT 1 FROM tag_follows tf2
          WHERE tf2.user_id = tag_follows.user_id
          AND tf2.group_id = tag_follows.group_id
          AND tf2.tag_id = ?
          AND tag_follows.tag_id = ANY(?)
        )
      `, [keepTagId, duplicateTagIds])

      await trx.raw(`
        UPDATE tag_follows
        SET tag_id = ?
        WHERE tag_id = ANY(?)
        AND NOT EXISTS (
          SELECT 1 FROM tag_follows tf2
          WHERE tf2.user_id = tag_follows.user_id
          AND tf2.group_id = tag_follows.group_id
          AND tf2.tag_id = ?
        )
      `, [keepTagId, duplicateTagIds, keepTagId])

      // Handle comments_tags relationships
      await trx.raw(`
        DELETE FROM comments_tags
        WHERE EXISTS (
          SELECT 1 FROM comments_tags ct2
          WHERE ct2.comment_id = comments_tags.comment_id
          AND ct2.tag_id = ?
          AND comments_tags.tag_id = ANY(?)
        )
      `, [keepTagId, duplicateTagIds])

      await trx.raw(`
        UPDATE comments_tags
        SET tag_id = ?
        WHERE tag_id = ANY(?)
        AND NOT EXISTS (
          SELECT 1 FROM comments_tags ct2
          WHERE ct2.comment_id = comments_tags.comment_id
          AND ct2.tag_id = ?
        )
      `, [keepTagId, duplicateTagIds, keepTagId])

      // Handle groups_tags relationships
      await trx.raw(`
        DELETE FROM groups_tags
        WHERE EXISTS (
          SELECT 1 FROM groups_tags gt2
          WHERE gt2.group_id = groups_tags.group_id
          AND gt2.tag_id = ?
          AND groups_tags.tag_id = ANY(?)
        )
      `, [keepTagId, duplicateTagIds])

      await trx.raw(`
        UPDATE groups_tags
        SET tag_id = ?
        WHERE tag_id = ANY(?)
        AND NOT EXISTS (
          SELECT 1 FROM groups_tags gt2
          WHERE gt2.group_id = groups_tags.group_id
          AND gt2.tag_id = ?
        )
      `, [keepTagId, duplicateTagIds, keepTagId])

      // Finally, delete the duplicate tags
      await trx('tags')
        .whereIn('id', duplicateTagIds)
        .delete()
    }

    await trx.raw(`
      UPDATE tags
      SET name = LOWER(name)
      WHERE name != LOWER(name)
    `)
  })
}

exports.down = function (knex) {
  // This migration cannot be safely reversed as it involves data deletion
  // and we don't store the original case information
  return Promise.resolve()
}
