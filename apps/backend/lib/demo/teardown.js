/* eslint-disable camelcase */
/**
 * Delete one demo by its marker, group slug, and fake-user emails.
 * Real invited members are not deleted. Their memberships are restored by the builder.
 */

/**
 * Indexes the foreign keys a rebuild checks. Without them, deleting a post
 * scans group_views_users (hundreds of thousands of rows) once per post.
 * @param {import('knex').Knex} knex
 */
async function ensureTeardownIndexes (knex) {
  const statements = [
    'create index if not exists group_views_users_last_read_post_id_idx on group_views_users (last_read_post_id) where last_read_post_id is not null',
    'create index if not exists group_views_post_id_idx on group_views (post_id) where post_id is not null',
    'create index if not exists notifications_activity_id_idx on notifications (activity_id)',
    'create index if not exists activities_post_id_idx on activities (post_id) where post_id is not null',
    'create index if not exists activities_comment_id_idx on activities (comment_id) where comment_id is not null'
  ]
  for (const statement of statements) await knex.raw(statement)
}

/**
 * Remove the previous copy of a demo.
 * @param {import('knex').Knex.Transaction} trx
 * @param {object} spec
 * @param {string|null} searchKind
 */
async function teardownDemo (trx, spec, searchKind) {
  const marker = markerFor(spec)
  const legacyMarkers = (spec.legacy && spec.legacy.createdFrom) || []
  const userIds = await demoUserIds(trx, spec)
  const groupIds = await demoGroupIds(trx, spec)
  const legacyKeys = (spec.legacy && spec.legacy.settingsKeys) || []
  const postIds = await collectPostIds(trx, groupIds, userIds, [marker].concat(legacyMarkers))
  const commentIds = postIds.length ? await trx('comments').whereIn('post_id', postIds).pluck('id') : []
  const locIds = await collectLocationIds(trx, groupIds, userIds, postIds)

  const activityIds = await trx('activities').where(function () {
    this.whereRaw("meta->>'demo' = ?", [spec.slug])
    legacyKeys.forEach(key => {
      this.orWhereRaw('meta->>? = ?', [key, 'true'])
    })
    if (postIds.length) this.orWhereIn('post_id', postIds)
    if (commentIds.length) this.orWhereIn('comment_id', commentIds)
    if (groupIds.length) this.orWhereIn('group_id', groupIds)
  }).pluck('id')
  if (activityIds.length) await trx('notifications').whereIn('activity_id', activityIds).del()
  if (activityIds.length) await trx('activities').whereIn('id', activityIds).del()

  if (searchKind === 'r') await deleteSearchRows(trx, postIds, commentIds, userIds, groupIds)

  await del(trx, 'reactions', 'entity_id', postIds.concat(commentIds))
  if (postIds.length) {
    const actionIds = await trx('moderation_actions').whereIn('post_id', postIds).pluck('id')
    if (actionIds.length) await trx('moderation_actions_agreements').whereIn('moderation_action_id', actionIds).del()
  }
  await del(trx, 'moderation_actions', 'post_id', postIds)
  if (postIds.length) {
    await trx('drafts').whereIn('post_id', postIds).orWhereIn('message_thread_id', postIds).del()
    await trx('saved_searches').whereIn('last_post_id', postIds).update({ last_post_id: null })
    await trx('tag_follows').whereIn('last_read_post_id', postIds).update({ last_read_post_id: null })
  }
  await del(trx, 'media', 'post_id', postIds)
  if (commentIds.length) await trx('media').whereIn('comment_id', commentIds).del()
  await del(trx, 'contributions', 'post_id', postIds)
  await del(trx, 'proposal_votes', 'post_id', postIds)
  await del(trx, 'proposal_options', 'post_id', postIds)
  await del(trx, 'event_invitations', 'event_id', postIds)
  await del(trx, 'event_responses', 'post_id', postIds)
  await del(trx, 'collections_posts', 'post_id', postIds)
  await del(trx, 'group_view_pins', 'post_id', postIds)
  await del(trx, 'posts_tags', 'post_id', postIds)
  await del(trx, 'posts_users', 'post_id', postIds)
  await del(trx, 'groups_posts', 'post_id', postIds)
  await del(trx, 'posts_about_users', 'post_id', postIds)
  await del(trx, 'project_contributions', 'post_id', postIds)
  if (commentIds.length) {
    await trx('comments_tags').whereIn('comment_id', commentIds).del()
    await trx('comments').whereIn('post_id', postIds).whereNotNull('comment_id').del()
    await trx('comments').whereIn('post_id', postIds).del()
  }
  await del(trx, 'project_roles', 'post_id', postIds)
  if (postIds.length) {
    await trx('posts').whereIn('parent_post_id', postIds).del()
    await trx('posts').whereIn('id', postIds).del()
  }

  if (groupIds.length) {
    const viewIds = await trx('group_views').whereIn('group_id', groupIds).pluck('id')
    if (viewIds.length) {
      await trx('group_views_users').whereIn('view_id', viewIds).del()
      await trx('collections_posts').whereIn('view_id', viewIds).del()
      await trx('group_view_pins').whereIn('view_id', viewIds).del()
    }
    await trx('group_views').whereIn('group_id', groupIds).orWhereIn('linked_group_id', groupIds).del()
    await trx('group_memberships_group_roles').whereIn('group_id', groupIds).del()
    await trx('group_memberships').whereIn('group_id', groupIds).del()
    const roleIds = await trx('groups_roles').whereIn('group_id', groupIds).pluck('id')
    if (roleIds.length) await trx('group_roles_responsibilities').whereIn('group_role_id', roleIds).del()
    await trx('groups_roles').whereIn('group_id', groupIds).del()
    await trx('group_join_questions_answers').whereIn('group_id', groupIds).del()
    await trx('join_requests').whereIn('group_id', groupIds).del()
    await trx('users_groups_agreements').whereIn('group_id', groupIds).del()
    const agreementIds = await trx('groups_agreements').whereIn('group_id', groupIds).pluck('agreement_id')
    await trx('groups_agreements').whereIn('group_id', groupIds).del()
    if (agreementIds.length) {
      await trx('agreements').whereIn('id', agreementIds).whereNotExists(function () {
        this.select(trx.raw('1')).from('groups_agreements').whereRaw('groups_agreements.agreement_id = agreements.id')
      }).del()
    }
    const questionIds = await trx('group_join_questions').whereIn('group_id', groupIds).pluck('question_id')
    await trx('group_join_questions').whereIn('group_id', groupIds).del()
    if (questionIds.length) {
      await trx('questions').whereIn('id', questionIds).whereNotExists(function () {
        this.select(trx.raw('1')).from('group_join_questions').whereRaw('group_join_questions.question_id = questions.id')
      }).del()
    }
    await trx('groups_tags').whereIn('group_id', groupIds).del()
    await trx('groups_suggested_skills').whereIn('group_id', groupIds).del()
    await trx('tag_follows').whereIn('group_id', groupIds).del()
    await trx('groups').whereIn('id', groupIds).update({ track_id: null, funding_round_id: null })
    await trx('tracks').whereIn('group_id', groupIds).del()
    await trx('funding_rounds').whereIn('group_id', groupIds).del()
    await trx('group_relationships').whereIn('parent_group_id', groupIds).orWhereIn('child_group_id', groupIds).del()
    await trx('groups').whereIn('parent_id', groupIds).del()
    await trx('groups').whereIn('id', groupIds).del()
  }

  if (userIds.length) {
    await trx('posts').whereIn('deactivated_by_id', userIds).update({ deactivated_by_id: null })
    await trx('comments').whereIn('deactivated_by_id', userIds).update({ deactivated_by_id: null })
    await trx('groups').whereIn('created_by_id', userIds).update({ created_by_id: null })
    await trx('event_invitations').whereIn('inviter_id', userIds).orWhereIn('user_id', userIds).del()
    const activityIds = await trx('activities').whereIn('actor_id', userIds).orWhereIn('reader_id', userIds).pluck('id')
    if (activityIds.length) {
      await trx('notifications').whereIn('activity_id', activityIds).del()
      await trx('activities').whereIn('id', activityIds).del()
    }
    await trx('notifications').whereIn('user_id', userIds).del()
    const commentIdsByUser = await trx('comments').whereIn('user_id', userIds).pluck('id')
    if (commentIdsByUser.length) {
      const commentActivities = await trx('activities').whereIn('comment_id', commentIdsByUser).orWhereIn('parent_comment_id', commentIdsByUser).pluck('id')
      if (commentActivities.length) {
        await trx('notifications').whereIn('activity_id', commentActivities).del()
        await trx('activities').whereIn('id', commentActivities).del()
      }
      await trx('comments').whereIn('comment_id', commentIdsByUser).del()
      await trx('comments').whereIn('id', commentIdsByUser).del()
    }
    await trx('posts_users').whereIn('user_id', userIds).del()
    await trx('reactions').whereIn('user_id', userIds).del()
    await trx('tag_follows').whereIn('user_id', userIds).del()
    await trx('group_views_users').whereIn('user_id', userIds).del()
    await trx('contributions').whereIn('user_id', userIds).del()
    await trx('proposal_votes').whereIn('user_id', userIds).del()
    await trx('skills_users').whereIn('user_id', userIds).del()
    await trx('linked_account').whereIn('user_id', userIds).del()
    await trx('group_memberships_group_roles').whereIn('user_id', userIds).del()
    await trx('group_memberships').whereIn('user_id', userIds).del()
    await deleteReferencingRows(trx, 'users', userIds)
    await trx('users').whereIn('id', userIds).whereRaw('lower(email) <> ?', [spec.realUserEmail.toLowerCase()]).del()
  }
  if (locIds.length) {
    await trx('locations').whereIn('id', locIds).whereNotExists(function () {
      this.select(trx.raw('1')).from('users').whereRaw('users.location_id = locations.id')
    }).whereNotExists(function () {
      this.select(trx.raw('1')).from('groups').whereRaw('groups.location_id = locations.id')
    }).whereNotExists(function () {
      this.select(trx.raw('1')).from('posts').whereRaw('posts.location_id = locations.id')
    }).del()
  }
}

/**
 * Memberships of people who joined a demo and are not part of the cast.
 * @param {import('knex').Knex.Transaction} trx
 * @param {object} spec
 * @returns {Promise<object[]>}
 */
async function captureInvitedMembers (trx, spec) {
  const slugs = [spec.group.slug].concat((spec.spaces || []).map(space => `${spec.group.slug}-${space.key}`))
  const groups = await trx('groups').whereIn('slug', slugs).select('id', 'slug')
  if (!groups.length) return []
  const slugById = {}
  groups.forEach(group => { slugById[group.id] = group.slug })
  const blocked = blockedEmails(spec)
  const rows = await trx('group_memberships')
    .join('users', 'users.id', 'group_memberships.user_id')
    .whereIn('group_memberships.group_id', groups.map(group => group.id))
    .where('group_memberships.active', true)
    .select('users.email', 'group_memberships.group_id', 'group_memberships.settings', 'group_memberships.created_at', 'group_memberships.new_post_count')
  return rows.filter(row => !blocked.has(String(row.email).toLowerCase())).map(row => ({
    email: row.email,
    groupSlug: slugById[row.group_id],
    settings: row.settings,
    created_at: row.created_at,
    new_post_count: row.new_post_count || 0
  }))
}

/**
 * Put saved invited memberships back after a rebuild.
 * Skips anyone the teardown already removed.
 * @param {import('knex').Knex.Transaction} trx
 * @param {object[]} saved
 * @param {function} asJson
 * @returns {Promise<number>} memberships actually written back
 */
async function restoreInvitedMembers (trx, saved, asJson) {
  let kept = 0
  for (const row of saved) {
    const user = await trx('users').whereRaw('lower(email) = ?', [String(row.email).toLowerCase()]).first('id')
    if (!user) continue
    const group = await trx('groups').where({ slug: row.groupSlug }).first('id')
    if (!group) continue
    const existing = await trx('group_memberships').where({ group_id: group.id, user_id: user.id }).first('id')
    if (existing) continue
    await trx('group_memberships').insert({
      group_id: group.id,
      user_id: user.id,
      active: true,
      created_at: row.created_at,
      updated_at: new Date(),
      new_post_count: row.new_post_count || 0,
      settings: asJson(row.settings || {})
    })
    kept += 1
  }
  return kept
}

const foreignKeyCache = new Map()

/**
 * Delete rows that point at these ids, and rows that point at those, so the
 * deferred foreign keys succeed. Stops on cycles.
 * @param {import('knex').Knex.Transaction} trx
 * @param {string} table
 * @param {Array<number|string>} ids
 * @param {Set<string>} [visiting]
 * @param {number} [depth]
 */
async function deleteReferencingRows (trx, table, ids, visiting = new Set(), depth = 0) {
  if (!ids || !ids.length || depth > 12) return
  const fresh = []
  ids.forEach(id => {
    const key = `${table}:${id}`
    if (visiting.has(key)) return
    visiting.add(key)
    fresh.push(id)
  })
  if (!fresh.length) return
  const fks = await foreignKeysTo(trx, table)
  for (const fk of fks) {
    const src = plainTable(fk.src)
    if (fk.on_delete === 'd') continue
    if (fk.on_delete === 'n') {
      await chunkUpdateNull(trx, src, fk.column_name, fresh)
      continue
    }
    const childIds = await pluckIds(trx, src, fk.column_name, fresh)
    if (childIds.length) await deleteReferencingRows(trx, src, childIds, visiting, depth + 1)
    await chunkDel(trx, src, fk.column_name, fresh)
  }
}

/**
 * Single-column foreign keys that point at a table.
 * @param {import('knex').Knex.Transaction} trx
 * @param {string} table
 * @returns {Promise<object[]>}
 */
async function foreignKeysTo (trx, table) {
  if (foreignKeyCache.has(table)) return foreignKeyCache.get(table)
  const result = await trx.raw(`
    select c.conrelid::regclass::text as src, a.attname as column_name, c.confdeltype as on_delete
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality as k(attnum, ord) on k.ord = 1
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and c.confrelid = ?::regclass and cardinality(c.conkey) = 1
  `, [table])
  foreignKeyCache.set(table, result.rows)
  return result.rows
}

/**
 * @param {string} name
 * @returns {string}
 */
function plainTable (name) {
  return String(name).replace(/"/g, '').split('.').pop()
}

/**
 * @param {import('knex').Knex.Transaction} trx
 * @param {string} table
 * @param {string} column
 * @param {Array<number|string>} ids
 * @returns {Promise<Array<number|string>>}
 */
async function pluckIds (trx, table, column, ids) {
  const hasId = await trx.raw(
    'select 1 from information_schema.columns where table_schema = ? and table_name = ? and column_name = ?',
    ['public', table, 'id']
  )
  if (!hasId.rows.length) return []
  const found = []
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const rows = await trx(table).whereIn(column, chunk).pluck('id')
    rows.forEach(id => found.push(id))
  }
  return found
}

/**
 * @param {import('knex').Knex.Transaction} trx
 * @param {string} table
 * @param {string} column
 * @param {Array<number|string>} ids
 */
async function chunkUpdateNull (trx, table, column, ids) {
  for (let i = 0; i < ids.length; i += 500) {
    await trx(table).whereIn(column, ids.slice(i, i + 500)).update({ [column]: null })
  }
}

/**
 * @param {import('knex').Knex.Transaction} trx
 * @param {string} table
 * @param {string} column
 * @param {Array<number|string>} ids
 */
async function chunkDel (trx, table, column, ids) {
  for (let i = 0; i < ids.length; i += 500) {
    await trx(table).whereIn(column, ids.slice(i, i + 500)).del()
  }
}

/**
 * @param {object} spec
 * @returns {string}
 */
function markerFor (spec) {
  return `demo:${spec.slug}`
}

/**
 * Emails the builder owns and must not treat as invited members.
 * @param {object} spec
 * @returns {Set<string>}
 */
function blockedEmails (spec) {
  const blocked = new Set()
  ;(spec.people || []).forEach(person => {
    if (person.email) blocked.add(person.email.toLowerCase())
  })
  if (spec.realUserEmail) blocked.add(spec.realUserEmail.toLowerCase())
  ;((spec.legacy && spec.legacy.emails) || []).forEach(email => blocked.add(String(email).toLowerCase()))
  return blocked
}

/**
 * User ids created for this demo. Never the real account.
 * @param {import('knex').Knex.Transaction} trx
 * @param {object} spec
 * @returns {Promise<Array<number|string>>}
 */
async function demoUserIds (trx, spec) {
  const emails = []
  ;(spec.people || []).forEach(person => {
    if (!person.realUser && person.email) emails.push(person.email.toLowerCase())
  })
  ;((spec.legacy && spec.legacy.emails) || []).forEach(email => emails.push(String(email).toLowerCase()))
  const ids = new Set()
  if (emails.length) {
    const rows = await trx('users').whereIn('email', emails).whereRaw('lower(email) <> ?', [spec.realUserEmail.toLowerCase()]).pluck('id')
    rows.forEach(id => ids.add(id))
  }
  const flagged = await trx('users').whereRaw("settings->>'demo' = ?", [spec.slug]).whereRaw('lower(email) <> ?', [spec.realUserEmail.toLowerCase()]).pluck('id')
  flagged.forEach(id => ids.add(id))
  for (const key of (spec.legacy && spec.legacy.settingsKeys) || []) {
    const rows = await trx('users').whereRaw('settings->>? = ?', [key, 'true']).whereRaw('lower(email) <> ?', [spec.realUserEmail.toLowerCase()]).pluck('id')
    rows.forEach(id => ids.add(id))
  }
  return [...ids]
}

/**
 * Group ids that belong to this demo, including a stand-in peer group.
 * @param {import('knex').Knex.Transaction} trx
 * @param {object} spec
 * @returns {Promise<Array<number|string>>}
 */
async function demoGroupIds (trx, spec) {
  const ids = new Set()
  const slugs = [spec.group.slug]
  if (spec.peer && spec.peer.standinSlug) slugs.push(spec.peer.standinSlug)
  const bySlug = await trx('groups').whereIn('slug', slugs).pluck('id')
  bySlug.forEach(id => ids.add(id))
  const flagged = await trx('groups').whereRaw("settings->>'demo' = ?", [spec.slug]).pluck('id')
  flagged.forEach(id => ids.add(id))
  if (ids.size) {
    const children = await trx('groups').whereIn('parent_id', [...ids]).pluck('id')
    children.forEach(id => ids.add(id))
  }
  return [...ids]
}

/**
 * @param {import('knex').Knex.Transaction} trx
 * @param {Array<number|string>} groupIds
 * @param {Array<number|string>} userIds
 * @param {string[]} markers
 * @returns {Promise<Array<number|string>>}
 */
async function collectPostIds (trx, groupIds, userIds, markers) {
  const ids = new Set()
  const marked = await trx('posts').whereIn('created_from', markers).pluck('id')
  marked.forEach(id => ids.add(id))
  if (groupIds.length) {
    const linked = await trx('groups_posts').whereIn('group_id', groupIds).pluck('post_id')
    linked.forEach(id => ids.add(id))
  }
  if (userIds.length) {
    const threads = await trx('posts').where({ type: 'thread' }).whereIn('user_id', userIds).pluck('id')
    threads.forEach(id => ids.add(id))
  }
  return [...ids]
}

/**
 * @param {import('knex').Knex.Transaction} trx
 * @param {Array<number|string>} groupIds
 * @param {Array<number|string>} userIds
 * @param {Array<number|string>} postIds
 * @returns {Promise<Array<number|string>>}
 */
async function collectLocationIds (trx, groupIds, userIds, postIds) {
  const ids = new Set()
  if (userIds.length) {
    const rows = await trx('users').whereIn('id', userIds).whereNotNull('location_id').pluck('location_id')
    rows.forEach(id => ids.add(id))
  }
  if (groupIds.length) {
    const rows = await trx('groups').whereIn('id', groupIds).whereNotNull('location_id').pluck('location_id')
    rows.forEach(id => ids.add(id))
  }
  if (postIds.length) {
    const rows = await trx('posts').whereIn('id', postIds).whereNotNull('location_id').pluck('location_id')
    rows.forEach(id => ids.add(id))
  }
  return [...ids]
}

/**
 * @param {import('knex').Knex.Transaction} trx
 * @param {Array<number|string>} postIds
 * @param {Array<number|string>} commentIds
 * @param {Array<number|string>} userIds
 * @param {Array<number|string>} groupIds
 */
async function deleteSearchRows (trx, postIds, commentIds, userIds, groupIds) {
  if (postIds.length) await trx('search_index').whereIn('post_id', postIds).del()
  if (commentIds.length) await trx('search_index').whereIn('comment_id', commentIds).del()
  if (userIds.length) await trx('search_index').whereIn('user_id', userIds).del()
  if (groupIds.length) await trx('search_index').whereIn('group_id', groupIds).del()
}

/**
 * Delete rows in chunks.
 * @param {import('knex').Knex.Transaction} trx
 * @param {string} table
 * @param {string} column
 * @param {Array<number|string>} ids
 */
async function del (trx, table, column, ids) {
  if (!ids || !ids.length) return
  const chunk = 500
  for (let i = 0; i < ids.length; i += chunk) {
    await trx(table).whereIn(column, ids.slice(i, i + chunk)).del()
  }
}

module.exports = {
  teardownDemo,
  ensureTeardownIndexes,
  captureInvitedMembers,
  restoreInvitedMembers,
  markerFor
}
