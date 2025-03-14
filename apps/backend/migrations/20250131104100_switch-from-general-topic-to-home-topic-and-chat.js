exports.up = async function (knex) {
  console.log('Switching from general topic to home topic and chat')
  const generalTag = await knex.select('id').from('tags').where('name', 'general').first()
  const homeTag = await knex.select('id').from('tags').where('name', 'home').first()

  if (!generalTag || !homeTag) {
    console.log('Missing required tags, skipping migration')
    return
  }

  const generalId = generalTag.id
  const homeId = homeTag.id

  if (!generalId || !homeId) {
    console.log('Missing required tags, skipping migration')
    return
  }

  await knex.raw(`
    UPDATE posts_tags
    SET tag_id = ?
    WHERE tag_id = ?
  `, [homeId, generalId])

  await knex.raw(`
    UPDATE groups_tags
    SET tag_id = ?
    WHERE tag_id = ? AND NOT EXISTS (
      SELECT 1 FROM groups_tags gt
      WHERE gt.group_id = groups_tags.group_id AND gt.tag_id = ?
    )
  `, [homeId, generalId, homeId])

  const groupsWithoutHomeTag = await knex.raw(`
    select id, num_members from groups where not exists (select 1 from groups_tags where groups_tags.group_id = groups.id and groups_tags.tag_id = ?);
  `, [homeId])

  groupsWithoutHomeTag.rows.forEach(async (row) => {
    const groupId = parseInt(row.id)
    const numMembers = parseInt(row.num_members || 0)
    let query = `INSERT INTO groups_tags (group_id, tag_id, is_default, visibility, num_followers, created_at, updated_at)
                 VALUES (${groupId}, ${homeId}, true, 2, ${numMembers}, current_timestamp, current_timestamp)
                 ON CONFLICT (group_id, tag_id)
                 DO UPDATE set num_followers = ${numMembers}, is_default = true, visibility = 2, updated_at = current_timestamp;`
    await knex.raw(query)
  })

  // Subscribe every user to every group's home topic
  await knex.raw(`
    UPDATE tag_follows
    SET tag_id = ?
    WHERE tag_id = ? AND NOT EXISTS (
      SELECT 1 FROM tag_follows tf
      WHERE tf.user_id = tag_follows.user_id AND tf.tag_id = ? AND tf.group_id = tag_follows.group_id
    )
  `, [homeId, generalId, homeId])

  const peopleNotFollowingHomeTag = await knex.raw(`
    select id, user_id, group_id from group_memberships where not exists (select 1 from tag_follows where tag_follows.user_id = group_memberships.user_id and tag_follows.tag_id = ?);
  `, [homeId])
  peopleNotFollowingHomeTag.rows.forEach(async (row) => {
    const userId = parseInt(row.user_id)
    const groupId = parseInt(row.group_id)
    let query = `INSERT INTO tag_follows (group_id, user_id, tag_id, new_post_count, created_at, updated_at)
                 VALUES (${groupId}, ${userId}, ${homeId}, 0, current_timestamp, current_timestamp) ON CONFLICT DO NOTHING;`
    await knex.raw(query)
  })


}

exports.down = async function (knex) {
  const generalTag = await knex.select('id').from('tags').where('name', 'general').first()
  const homeTag = await knex.select('id').from('tags').where('name', 'home').first()

  if (!generalTag || !homeTag) {
    console.log('Missing required tags, skipping migration')
    return
  }

  const generalId = generalTag.id
  const homeId = homeTag.id

  if (!generalId || !homeId) {
    console.log('Missing required tags, skipping migration')
    return
  }

  await knex.raw(`
    UPDATE posts_tags
    SET tag_id = ?
    WHERE tag_id = ?
  `, [generalId, homeId])

  await knex.raw(`
    UPDATE groups_tags
    SET tag_id = ?
    WHERE tag_id = ? AND NOT EXISTS (
      SELECT 1 FROM groups_tags gt
      WHERE gt.group_id = groups_tags.group_id AND gt.tag_id = ?
    )
  `, [generalId, homeId, generalId])

  const groupsWithoutGeneralTag = await knex.raw(`
    select id, num_members from groups where not exists (select 1 from groups_tags where groups_tags.group_id = groups.id and groups_tags.tag_id = ?);
  `, [generalId])

  groupsWithoutGeneralTag.rows.forEach(async (row) => {
    const groupId = parseInt(row.id)
    const numMembers = parseInt(row.num_members || 0)
    let query = `INSERT INTO groups_tags (group_id, tag_id, is_default, visibility, num_followers, created_at, updated_at)
                 VALUES (${groupId}, ${generalId}, true, 2, ${numMembers}, current_timestamp, current_timestamp)
                 ON CONFLICT (group_id, tag_id)
                 DO UPDATE set num_followers = ${numMembers}, is_default = true, visibility = 2, updated_at = current_timestamp;`
    await knex.raw(query)
  })

  // Subscribe every user to every group's home topic
  await knex.raw(`
    UPDATE tag_follows
    SET tag_id = ?
    WHERE tag_id = ? AND NOT EXISTS (
      SELECT 1 FROM tag_follows tf
      WHERE tf.user_id = tag_follows.user_id AND tf.tag_id = ? AND tf.group_id = tag_follows.group_id
    )
  `, [generalId, homeId, generalId])

  const peopleNotFollowingGeneralTag = await knex.raw(`
    select id, user_id, group_id from group_memberships where not exists (select 1 from tag_follows where tag_follows.user_id = group_memberships.user_id and tag_follows.tag_id = ?);
  `, [generalId])
  peopleNotFollowingGeneralTag.rows.forEach(async (row) => {
    const userId = parseInt(row.user_id)
    const groupId = parseInt(row.group_id)
    let query = `INSERT INTO tag_follows (group_id, user_id, tag_id, new_post_count, created_at, updated_at)
                 VALUES (${groupId}, ${userId}, ${generalId}, 0, current_timestamp, current_timestamp) ON CONFLICT DO NOTHING;`
    await knex.raw(query)
  })
}
