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
        WITH duplicate_relationships AS (
          SELECT post_id, tag_id FROM posts_tags
          WHERE tag_id = ANY(?)
        )
        DELETE FROM posts_tags
        WHERE EXISTS (
          SELECT 1 FROM duplicate_relationships dr
          WHERE posts_tags.post_id = dr.post_id
          AND posts_tags.tag_id = dr.tag_id
          AND EXISTS (
            SELECT 1 FROM posts_tags pt2
            WHERE pt2.post_id = dr.post_id
            AND pt2.tag_id = ?
          )
        );
        UPDATE posts_tags
        SET tag_id = ?
        WHERE tag_id = ANY(?)
        AND NOT EXISTS (
          SELECT 1 FROM posts_tags pt2
          WHERE pt2.post_id = posts_tags.post_id
          AND pt2.tag_id = ?
        );
      `, [duplicateTagIds, keepTagId, keepTagId, duplicateTagIds, keepTagId])

      // Handle tag_follows relationships
      await trx.raw(`
        WITH duplicate_relationships AS (
          SELECT user_id, group_id, tag_id FROM tag_follows
          WHERE tag_id = ANY(?)
        )
        DELETE FROM tag_follows
        WHERE EXISTS (
          SELECT 1 FROM duplicate_relationships dr
          WHERE tag_follows.user_id = dr.user_id
          AND tag_follows.group_id = dr.group_id
          AND tag_follows.tag_id = dr.tag_id
          AND EXISTS (
            SELECT 1 FROM tag_follows tf2
            WHERE tf2.user_id = dr.user_id
            AND tf2.group_id = dr.group_id
            AND tf2.tag_id = ?
          )
        );
        UPDATE tag_follows
        SET tag_id = ?
        WHERE tag_id = ANY(?)
        AND NOT EXISTS (
          SELECT 1 FROM tag_follows tf2
          WHERE tf2.user_id = tag_follows.user_id
          AND tf2.group_id = tag_follows.group_id
          AND tf2.tag_id = ?
        );
      `, [duplicateTagIds, keepTagId, keepTagId, duplicateTagIds, keepTagId])

      // Handle comments_tags relationships
      await trx.raw(`
        WITH duplicate_relationships AS (
          SELECT comment_id, tag_id FROM comments_tags
          WHERE tag_id = ANY(?)
        )
        DELETE FROM comments_tags
        WHERE EXISTS (
          SELECT 1 FROM duplicate_relationships dr
          WHERE comments_tags.comment_id = dr.comment_id
          AND comments_tags.tag_id = dr.tag_id
          AND EXISTS (
            SELECT 1 FROM comments_tags ct2
            WHERE ct2.comment_id = dr.comment_id
            AND ct2.tag_id = ?
          )
        );
        UPDATE comments_tags
        SET tag_id = ?
        WHERE tag_id = ANY(?)
        AND NOT EXISTS (
          SELECT 1 FROM comments_tags ct2
          WHERE ct2.comment_id = comments_tags.comment_id
          AND ct2.tag_id = ?
        );
      `, [duplicateTagIds, keepTagId, keepTagId, duplicateTagIds, keepTagId])

      // Handle groups_tags relationships
      await trx.raw(`
        WITH duplicate_relationships AS (
          SELECT group_id, tag_id FROM groups_tags
          WHERE tag_id = ANY(?)
        )
        DELETE FROM groups_tags
        WHERE EXISTS (
          SELECT 1 FROM duplicate_relationships dr
          WHERE groups_tags.group_id = dr.group_id
          AND groups_tags.tag_id = dr.tag_id
          AND EXISTS (
            SELECT 1 FROM groups_tags gt2
            WHERE gt2.group_id = dr.group_id
            AND gt2.tag_id = ?
          )
        );
        UPDATE groups_tags
        SET tag_id = ?
        WHERE tag_id = ANY(?)
        AND NOT EXISTS (
          SELECT 1 FROM groups_tags gt2
          WHERE gt2.group_id = groups_tags.group_id
          AND gt2.tag_id = ?
        );
      `, [duplicateTagIds, keepTagId, keepTagId, duplicateTagIds, keepTagId])

      // Finally, delete the duplicate tags
      await trx('tags')
        .whereIn('id', duplicateTagIds)
        .delete()
    }
  })
}

exports.down = function (knex) {
  // This migration cannot be safely reversed as it involves data deletion
  // and we don't store the original case information
  return Promise.resolve()
}
