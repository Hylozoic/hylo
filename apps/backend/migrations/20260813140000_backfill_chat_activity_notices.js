exports.up = async function (knex) {
  const axolotl = await knex('users').where({ id: 13986 }).first()
  if (!axolotl) return

  const result = await knex.raw(`
    SELECT
      gp.group_id,
      to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24') AS bucket_hour,
      count(*)::int AS post_count,
      max(p.created_at) AS newest_at,
      (array_agg(p.id ORDER BY p.created_at DESC, p.id DESC))[1:5] AS recent_ids
    FROM posts p
    JOIN groups_posts gp ON gp.post_id = p.id
    WHERE p.type = 'chat'
      AND p.active = true
      AND p.created_at > now() - interval '30 days'
    GROUP BY gp.group_id, to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24')
  `)

  for (const row of result.rows) {
    const bucketKey = `${row.group_id}:${row.bucket_hour}`
    const noticeData = {
      bucketKey,
      groupId: Number(row.group_id),
      bucketStart: `${row.bucket_hour}:00:00.000Z`,
      recentPostIds: (row.recent_ids || []).map(Number),
      postCount: row.post_count
    }

    const existing = await knex('posts')
      .whereRaw("notice_data->>'bucketKey' = ?", [bucketKey])
      .first()

    if (existing) {
      await knex('posts').where({ id: existing.id }).update({
        notice_data: JSON.stringify(noticeData),
        active: true,
        deactivated_at: null,
        created_at: row.newest_at,
        updated_at: row.newest_at
      })
      continue
    }

    const inserted = await knex('posts').insert({
      user_id: 13986,
      type: 'chat_activity',
      active: true,
      notice_data: JSON.stringify(noticeData),
      created_at: row.newest_at,
      updated_at: row.newest_at,
      num_comments: 0,
      num_commenters: 0,
      num_people_reacts: 0
    }).returning('id')
    const postId = inserted[0]?.id || inserted[0]
    const existingMembership = await knex('groups_posts')
      .where({ group_id: row.group_id, post_id: postId })
      .first()
    if (!existingMembership) {
      await knex('groups_posts').insert({ group_id: row.group_id, post_id: postId })
    }
  }
}

exports.down = async function (knex) {
  const ids = knex('posts').select('id').where({ type: 'chat_activity' })
  await knex('groups_posts').whereIn('post_id', ids).del()
  await knex('posts').where({ type: 'chat_activity' }).del()
}
