// Spaces & Views — Phase 1, data migration.
// See docs/spaces-and-views-engineering-spec.md section 5 (steps 1b - 10).
//
// IMPORTANT: this is a best-effort implementation of a complex, one-time data
// migration written without the ability to run it against a real database in
// this environment (migration commands are disabled in this sandbox). Every
// step is written to be idempotent (safe to re-run) and each top-level entity
// (group / track / funding round) is migrated in its own transaction so a
// failure partway through doesn't require redoing already-migrated entities.
// This MUST be run against a staging copy of production data and verified
// (see Step 11 checks at the bottom) before it is ever run for real.
//
// Legacy tables (context_widgets, custom_views, tracks_posts, tracks_users,
// funding_rounds_posts, funding_rounds_users, collections, collections_posts)
// are intentionally NOT dropped here — that destructive cleanup is deferred
// to a follow-up migration once the new Spaces & Views system is verified
// working in production (see spec Phase 6).
//
// Step 9 (#general posts_tags cleanup) is also deferred to that Phase 6
// cleanup migration — it is destructive and not reversible, so it is
// intentionally omitted here to keep dev rollback workable.
//
// `down` is provided for development: roll back, fix `up`, and re-run.
// It is NOT safe for production once real post-migration activity exists.

const SYSTEM_VIEW_TYPE_BY_WIDGET_VIEW = {
  stream: 'all',
  map: 'map',
  events: 'events',
  discussions: 'discussions',
  proposals: 'proposals',
  resources: 'resources',
  'requests-and-offers': 'requests-and-offers',
  projects: 'projects',
  members: 'members',
  about: 'about',
  welcome: 'welcome',
  'related-groups': 'related-groups'
}
const SKIPPED_WIDGET_VIEWS = ['all-topics', 'setup']

const SYSTEM_ROLES = [
  {
    name: 'Coordinator',
    emoji: '🪄',
    description: 'Coordinators are empowered to do everything related to group administration.',
    responsibilities: ['Administration', 'Add Members', 'Remove Members', 'Manage Content', 'Manage Tracks', 'Manage Rounds', 'Manage Spaces']
  },
  {
    name: 'Moderator',
    emoji: '⚖️',
    description: 'Moderators are expected to actively engage in discussion, encourage participation, and take corrective action if a member violates group agreements.',
    responsibilities: ['Manage Content', 'Remove Members']
  },
  {
    name: 'Host',
    emoji: '👋',
    description: 'Hosts are responsible for cultivating a good atmosphere by welcoming and orienting new members, embodying the group culture and agreements, and helping members connect with relevant content and people.',
    responsibilities: ['Add Members']
  }
]

exports.up = async function (knex) {
  await applyMigrationDefaults(knex)
  await migrateMainSpaceViews(knex)
  await migrateTracks(knex)
  await migrateFundingRounds(knex)
  await backfillGroupViewsUsers(knex)
  await updateHomeRoutes(knex)
}

exports.down = async function (knex) {
  // Development rollback — undo everything `up` created so the migration can
  // be re-run from context_widgets. Does NOT restore #general posts_tags
  // (that step is deferred to Phase 6 cleanup; see file header).
  await rollbackMigratedSpaces(knex)
  await deleteMainGroupViews(knex)
  await revertHomeRoutes(knex)
  await revertMigrationDefaults(knex)
}

// ---------------------------------------------------------------------------
// Step 1b — migration defaults
// ---------------------------------------------------------------------------

async function applyMigrationDefaults (knex) {
  // accepted_post_types is left null (= all types accepted) by the column
  // default already, nothing to do there.
  await knex.raw(`
    UPDATE groups
    SET settings = coalesce(settings, '{}'::jsonb) || '{"showPostNoticesInChat": true}'::jsonb
    WHERE coalesce(settings->>'showPostNoticesInChat', '') != 'true'
  `)
}

// ---------------------------------------------------------------------------
// Steps 2, 4, 5, 8, 9 — flatten each pre-existing top-level group's
// ContextWidget tree into an ordered group_views list, promoting chat rooms
// (other than #general / the home chat) to their own Chat Spaces along the
// way.
// ---------------------------------------------------------------------------

async function migrateMainSpaceViews (knex) {
  const generalTagId = await getGeneralTagId(knex)

  const groups = await knex('groups')
    .whereRaw("type IS DISTINCT FROM 'space'")
    .select('id', 'slug', 'settings')

  for (const group of groups) {
    // Idempotent: skip groups that already have views (either migrated
    // already, or created directly as a space/group post-migration).
    const alreadyMigrated = await knex('group_views').where({ group_id: group.id }).first()
    if (alreadyMigrated) continue

    await knex.transaction(trx => migrateGroupMenu(trx, group, generalTagId))
  }
}

async function migrateGroupMenu (trx, group, generalTagId) {
  const widgets = await trx('context_widgets').where({ group_id: group.id })
  if (widgets.length === 0) {
    // No legacy menu at all — seed the same minimal default a brand new space gets.
    await insertGroupViews(trx, group.id, [{ type: 'welcome' }, { type: 'chat' }, { type: 'members' }])
    return
  }

  const childrenOf = parentId => widgets
    .filter(w => w.parent_id === parentId && w.order !== null)
    .sort((a, b) => a.order - b.order)

  const homeWidget = widgets.find(w => w.type === 'home')
  const homeChild = homeWidget ? widgets.find(w => w.parent_id === homeWidget.id) : null

  // Emitted items, in final display order. Each item is either:
  //  - { view: {...group_views row fields...} } — a row for this group's own menu
  //  - { space: {...} } — a request to create a child space, whose menu entry
  //    (type='space') gets inserted here
  const emitted = []
  let homeItem = null

  const emitHomeChat = () => ({ view: { type: 'chat' } })

  const emitChatWidget = widget => {
    const isGeneral = generalTagId && widget.view_chat_id === generalTagId
    const isHome = homeChild && widget.id === homeChild.id
    if (isGeneral || isHome) return emitHomeChat()
    return { space: { kind: 'chat', widget } }
  }

  const emitWidget = widget => {
    if (widget.view_chat_id) return emitChatWidget(widget)
    if (widget.view_track_id) return { space: { kind: 'track', widget } }
    if (widget.view_funding_round_id) return { space: { kind: 'fundingRound', widget } }
    if (widget.custom_view_id) return { customViewWidget: widget }
    if (widget.view_post_id) return { view: { type: 'post', post_id: widget.view_post_id, name: widget.title, icon: widget.icon } }
    if (widget.view_group_id) return { view: { type: 'group', linked_group_id: widget.view_group_id, name: widget.title, icon: widget.icon } }
    if (widget.view_user_id) return { view: { type: 'member', user_id: widget.view_user_id, name: widget.title, icon: widget.icon } }
    if (widget.type === 'container') return { view: { type: 'text', name: widget.title, icon: widget.icon }, children: childrenOf(widget.id) }
    if (widget.view && SKIPPED_WIDGET_VIEWS.includes(widget.view)) return null
    if (widget.view && SYSTEM_VIEW_TYPE_BY_WIDGET_VIEW[widget.view]) {
      return { view: { type: SYSTEM_VIEW_TYPE_BY_WIDGET_VIEW[widget.view], name: widget.title, icon: widget.icon } }
    }
    // Unrecognized widget (e.g. a stray 'chats' folder with no children, or a
    // 'home' node reached directly) — nothing to emit for it directly.
    return null
  }

  // Walk a widget, expanding structural containers ('chats' folder, 'container').
  const walk = widget => {
    if (widget.type === 'chats') {
      for (const child of childrenOf(widget.id)) walk(child)
      return
    }
    const result = emitWidget(widget)
    if (!result) return

    if (result.customViewWidget) {
      // Resolved separately below (needs an async DB lookup for the CustomView row)
      emitted.push({ customViewWidget: result.customViewWidget, isHome: !!(homeChild && widget.id === homeChild.id) })
      return
    }

    const isHome = !!(homeChild && widget.id === homeChild.id)
    const item = { ...result, isHome }
    if (isHome && !homeItem) {
      homeItem = item
    } else {
      emitted.push(item)
    }

    if (result.children) {
      for (const child of result.children) walk(child)
    }
  }

  const topLevel = childrenOf(null)
  for (const widget of topLevel) walk(widget)

  // Resolve custom_view widgets (async) into concrete view/space items, in place.
  const resolvedItems = []
  if (homeItem?.customViewWidget) {
    resolvedItems.push(await resolveCustomViewItem(trx, homeItem))
  }
  for (const item of emitted) {
    resolvedItems.push(item.customViewWidget ? await resolveCustomViewItem(trx, item) : item)
  }

  const finalHome = homeItem?.customViewWidget ? resolvedItems[0] : homeItem
  const finalRest = homeItem?.customViewWidget ? resolvedItems.slice(1) : resolvedItems.filter(r => r !== homeItem)

  const orderedItems = finalHome ? [finalHome, ...finalRest] : finalRest
  if (orderedItems.length === 0) {
    await insertGroupViews(trx, group.id, [{ type: 'welcome' }, { type: 'chat' }, { type: 'members' }])
    return
  }

  // Materialize: plain views get inserted directly; spaces get created (with
  // their own default views) and a type='space' menu entry inserted here;
  // collection views are inserted as plain views, with their collection_posts
  // migrated afterwards once the row (and its real id) exists.
  const viewsToInsert = []
  const collectionTasks = []
  for (const item of orderedItems) {
    if (item.collectionView) {
      viewsToInsert.push({ type: 'collection', name: item.collectionView.customView.name, icon: item.collectionView.customView.icon })
      collectionTasks.push({ index: viewsToInsert.length - 1, customView: item.collectionView.customView })
    } else if (item.view) {
      viewsToInsert.push(item.view)
    } else if (item.space) {
      const spaceId = await createSpaceFromWidget(trx, group, item.space)
      if (spaceId) viewsToInsert.push({ type: 'space', linked_group_id: spaceId })
    }
  }

  const insertedViews = await insertGroupViews(trx, group.id, viewsToInsert)

  const now = new Date()
  for (const task of collectionTasks) {
    const view = insertedViews[task.index]
    const linkedPosts = await trx('collections_posts').where({ collection_id: task.customView.collection_id }).orderBy('order', 'asc')
    for (const lp of linkedPosts) {
      await trx('collection_posts').insert({
        view_id: view.id,
        post_id: lp.post_id,
        order: lp.order || 0,
        created_at: now
      }).onConflict(['view_id', 'post_id']).ignore()
    }
  }
}

async function resolveCustomViewItem (trx, item) {
  const widget = item.customViewWidget
  const customView = await trx('custom_views').where({ id: widget.custom_view_id }).first()
  if (!customView) return { view: null }

  if (customView.type === 'externalLink') {
    return {
      view: { type: 'link', name: customView.name, icon: customView.icon, link: customView.external_link },
      isHome: item.isHome
    }
  }

  if (customView.type === 'collection') {
    // Unlike tracks/rounds/chats, a 'collection' view lives directly on the
    // parent group (see GroupView type='collection') rather than becoming a
    // child space, so it's handled as a plain view + a deferred post-insert
    // step to migrate collection_posts once the view has a real id.
    return { collectionView: { customView }, isHome: item.isHome }
  }

  // 'stream' or null — a filtered custom feed
  const topicRows = await trx('custom_view_topics')
    .join('tags', 'tags.id', 'custom_view_topics.tag_id')
    .where('custom_view_topics.custom_view_id', customView.id)
    .select('tags.name')
  return {
    view: {
      type: 'custom',
      name: customView.name,
      icon: customView.icon,
      topics: JSON.stringify(topicRows.map(t => t.name)),
      settings: JSON.stringify({
        postTypes: customView.post_types,
        activePostsOnly: customView.active_posts_only,
        defaultSort: customView.default_sort,
        defaultViewMode: customView.default_view_mode,
        searchText: customView.search_text
      })
    },
    isHome: item.isHome
  }
}

// Creates a Track / FundingRound / Chat / Collection space for a menu item
// that needs one, and returns its new group id (or null if already migrated —
// idempotent re-run support keyed off the source entity).
async function createSpaceFromWidget (trx, parentGroup, spaceRequest) {
  if (spaceRequest.kind === 'track') {
    return createTrackSpace(trx, parentGroup, spaceRequest.widget.view_track_id)
  }
  if (spaceRequest.kind === 'fundingRound') {
    return createFundingRoundSpace(trx, parentGroup, spaceRequest.widget.view_funding_round_id)
  }
  if (spaceRequest.kind === 'chat') {
    return createChatSpace(trx, parentGroup, spaceRequest.widget)
  }
  return null
}

// ---------------------------------------------------------------------------
// Step 6 — Tracks -> Track Spaces
// ---------------------------------------------------------------------------

// Handles a single (track, group) pair encountered while walking a group's
// menu. Full standalone migration of any remaining un-menu'd tracks (e.g.
// drafts destined for More Spaces) is handled by migrateTracks() below.
async function createTrackSpace (trx, parentGroup, trackId) {
  const track = await trx('tracks').where({ id: trackId }).first()
  if (!track) return null
  if (track.group_id) return track.group_id

  return buildTrackSpace(trx, parentGroup, track)
}

async function buildTrackSpace (trx, parentGroup, track) {
  const now = new Date()
  const slug = await uniqueSlug(trx, parentGroup.slug, track.name)

  const [space] = await trx('groups').insert({
    name: track.name,
    slug,
    type: 'space',
    parent_id: parentGroup.id,
    track_id: track.id,
    description: track.description,
    banner_url: track.banner_url,
    active: !track.deactivated_at,
    visibility: 2,
    accessibility: 1,
    settings: '{}',
    access_code: await newAccessCode(trx),
    calendar_token: uuidv4(),
    created_at: now,
    updated_at: now
  }).returning('id')
  const spaceId = space.id ?? space

  await trx('tracks').where({ id: track.id }).update({ group_id: spaceId })

  const welcomeView = await insertGroupViews(trx, spaceId, [
    { type: 'welcome', page_content: track.welcome_message },
    { type: 'track-actions' },
    { type: 'chat' },
    { type: 'members' }
  ])
  const trackActionsView = welcomeView.find(v => v.type === 'track-actions')

  const trackPosts = await trx('tracks_posts').where({ track_id: track.id }).orderBy('sort_order', 'asc')
  for (const tp of trackPosts) {
    await trx('collection_posts').insert({
      view_id: trackActionsView.id,
      post_id: tp.post_id,
      order: tp.sort_order || 0,
      created_at: now
    }).onConflict(['view_id', 'post_id']).ignore()
  }

  await migrateSpaceMembers(trx, spaceId, parentGroup.id, async () => {
    const trackUsers = await trx('tracks_users').where({ track_id: track.id })
    return trackUsers.map(tu => ({
      user_id: tu.user_id,
      settingsPatch: { enrolledAt: tu.enrolled_at, completedAt: tu.completed_at || undefined }
    }))
  })

  return spaceId
}

// Full pass over any tracks that don't yet have a menu entry anywhere (e.g.
// unpublished/deactivated drafts) so they still get a space + group_id set —
// they're simply left out of any parent menu (spec 1b.4 — surfaced via More
// Spaces instead).
//
// KNOWN LIMITATION (inherited from the spec, section 5 step 6): tracks.group_id
// is a single scalar column, but a track can belong to multiple groups via
// groups_tracks. If the same track is shared across more than one group, only
// the first group processed gets a migrated space here — the null-check-based
// idempotency can't tell "migrated for group A" apart from "still needs group
// B". This should be rare in practice; flagging for manual QA post-migration.
async function migrateTracks (knex) {
  const trackGroupPairs = await knex('groups_tracks')
  for (const pair of trackGroupPairs) {
    const track = await knex('tracks').where({ id: pair.track_id }).first()
    const parentGroup = await knex('groups').where({ id: pair.group_id }).first()
    if (!track || !parentGroup || track.group_id) continue

    await knex.transaction(trx => buildTrackSpace(trx, parentGroup, track))
  }
}

// ---------------------------------------------------------------------------
// Step 7 — Funding Rounds -> Funding Round Spaces
// ---------------------------------------------------------------------------

async function createFundingRoundSpace (trx, parentGroup, fundingRoundId) {
  const round = await trx('funding_rounds').where({ id: fundingRoundId }).first()
  if (!round) return null

  // Unlike tracks, funding_rounds.group_id was NOT NULL before this migration
  // (it's the round's pre-existing parent group), so "already migrated" has to
  // be detected via the new space itself rather than a null check.
  const existingSpace = await trx('groups').where({ funding_round_id: round.id, type: 'space' }).first()
  if (existingSpace) return existingSpace.id

  return buildFundingRoundSpace(trx, parentGroup, round)
}

async function buildFundingRoundSpace (trx, parentGroup, round) {
  const now = new Date()
  const slug = await uniqueSlug(trx, parentGroup.slug, round.title)

  const [space] = await trx('groups').insert({
    name: round.title,
    slug,
    type: 'space',
    parent_id: parentGroup.id,
    funding_round_id: round.id,
    description: round.description,
    banner_url: round.banner_url,
    active: !round.deactivated_at,
    visibility: 2,
    accessibility: 1,
    settings: '{}',
    access_code: await newAccessCode(trx),
    calendar_token: uuidv4(),
    created_at: now,
    updated_at: now
  }).returning('id')
  const spaceId = space.id ?? space

  await trx('funding_rounds').where({ id: round.id }).update({ group_id: spaceId })

  await insertGroupViews(trx, spaceId, [
    { type: 'welcome' },
    { type: 'funding-round-submissions' },
    { type: 'chat' },
    { type: 'members' }
  ])

  const submissions = await trx('funding_rounds_posts').where({ funding_round_id: round.id })
  for (const s of submissions) {
    await trx('groups_posts').insert({ group_id: spaceId, post_id: s.post_id })
      .onConflict(['group_id', 'post_id']).ignore()
  }

  await migrateSpaceMembers(trx, spaceId, parentGroup.id, async () => {
    const roundUsers = await trx('funding_rounds_users').where({ funding_round_id: round.id })
    return roundUsers.map(ru => ({
      user_id: ru.user_id,
      settingsPatch: { tokensRemaining: ru.tokens_remaining }
    }))
  })

  return spaceId
}

// Full pass over any funding rounds that don't yet have a menu entry anywhere
// (e.g. drafts) — mirrors migrateTracks() above. Rounds already migrated via
// the menu walk are skipped because their group_id now points at a
// type='space' group with a matching funding_round_id.
async function migrateFundingRounds (knex) {
  const rounds = await knex('funding_rounds')
  for (const round of rounds) {
    const parentGroup = await knex('groups').where({ id: round.group_id }).first()
    if (!parentGroup || parentGroup.type === 'space') continue

    await knex.transaction(trx => createFundingRoundSpace(trx, parentGroup, round.id))
  }
}

// ---------------------------------------------------------------------------
// Step 8 — Chat rooms -> Chat Spaces
// ---------------------------------------------------------------------------

async function createChatSpace (trx, parentGroup, widget) {
  const tag = await trx('tags').where({ id: widget.view_chat_id }).first()
  if (!tag) return null

  const now = new Date()
  const slug = await uniqueSlug(trx, parentGroup.slug, tag.name)

  const [space] = await trx('groups').insert({
    name: tag.name,
    slug,
    type: 'space',
    parent_id: parentGroup.id,
    accepted_post_types: JSON.stringify(['chat']),
    required_roles: widget.visibility === 'admin' ? JSON.stringify([1]) : null,
    active: true,
    visibility: 2,
    accessibility: 1,
    settings: '{}',
    access_code: await newAccessCode(trx),
    calendar_token: uuidv4(),
    created_at: now,
    updated_at: now
  }).returning('id')
  const spaceId = space.id ?? space

  const [chatView] = await insertGroupViews(trx, spaceId, [{ type: 'chat' }])

  // Reassociate chat posts for this topic from the parent group to the new space
  const taggedPostIds = await trx('posts_tags').where({ tag_id: tag.id }).pluck('post_id')
  if (taggedPostIds.length > 0) {
    await trx('groups_posts')
      .where({ group_id: parentGroup.id })
      .whereIn('post_id', taggedPostIds)
      .update({ group_id: spaceId })
  }

  await migrateSpaceMembers(trx, spaceId, parentGroup.id, async () => {
    const follows = await trx('tag_follows')
      .where({ group_id: parentGroup.id, tag_id: tag.id })
      .whereRaw("coalesce(settings->>'notifications', '') != ''")
      .whereRaw("settings->>'notifications' != 'false'")
    return follows.map(f => ({
      user_id: f.user_id,
      settingsPatch: { postNotifications: f.settings?.notifications },
      newPostCount: f.new_post_count,
      lastReadPostId: f.last_read_post_id,
      viewId: chatView.id
    }))
  })

  return spaceId
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function insertGroupViews (trx, groupId, views) {
  const now = new Date()
  const rows = views.map((v, i) => ({
    group_id: groupId,
    order: i,
    created_at: now,
    updated_at: now,
    ...v
  }))
  return trx('group_views').insert(rows).returning('*')
}

// Bulk-creates group_memberships (+ per-view group_views_users rows) for a new
// space's members, mirroring only the settings fields called out in the spec
// rather than the full Group.addMembers() side effects (default tag follows,
// activity notifications, etc.) which don't apply to a historical backfill.
async function migrateSpaceMembers (trx, spaceId, parentGroupId, fetchMembers) {
  const members = await fetchMembers()
  if (members.length === 0) return

  const now = new Date()
  const views = await trx('group_views').where({ group_id: spaceId })

  for (const member of members) {
    const parentMembership = await trx('group_memberships')
      .where({ group_id: parentGroupId, user_id: member.user_id, active: true })
      .first()
    if (!parentMembership) continue

    const existing = await trx('group_memberships').where({ group_id: spaceId, user_id: member.user_id }).first()
    if (!existing) {
      await trx('group_memberships').insert({
        group_id: spaceId,
        user_id: member.user_id,
        active: true,
        settings: JSON.stringify({ ...(parentMembership.settings || {}), ...member.settingsPatch }),
        created_at: now,
        updated_at: now
      })
    }

    for (const view of views) {
      const isTargetView = !member.viewId || member.viewId === view.id
      await trx('group_views_users').insert({
        view_id: view.id,
        user_id: member.user_id,
        new_post_count: isTargetView ? (member.newPostCount || 0) : 0,
        last_read_post_id: isTargetView ? (member.lastReadPostId || null) : null,
        created_at: now,
        updated_at: now
      }).onConflict(['view_id', 'user_id']).ignore()
    }
  }

  // Give the parent group's existing Coordinators administrative access to
  // the new space too (system roles are per-space in the new model — see
  // docs/spaces-and-views-engineering-spec.md section 3, "role inheritance" —
  // without this, migrated spaces would otherwise have no one able to manage
  // them until Hylo staff intervenes).
  await grantParentCoordinatorsAccess(trx, spaceId, parentGroupId)
}

async function grantParentCoordinatorsAccess (trx, spaceId, parentGroupId) {
  const spaceCoordinatorRoleId = await setupSystemRoles(trx, spaceId)
  const parentCoordinatorRole = await trx('groups_roles').where({ group_id: parentGroupId, name: 'Coordinator', type: 'system' }).first()
  if (!parentCoordinatorRole) return

  const parentCoordinators = await trx('group_memberships_group_roles')
    .where({ group_role_id: parentCoordinatorRole.id, active: true })
    .pluck('user_id')

  const now = new Date()
  for (const userId of parentCoordinators) {
    const existing = await trx('group_memberships_group_roles')
      .where({ group_id: spaceId, user_id: userId, group_role_id: spaceCoordinatorRoleId })
      .first()
    if (!existing) {
      await trx('group_memberships_group_roles').insert({
        group_id: spaceId,
        user_id: userId,
        group_role_id: spaceCoordinatorRoleId,
        active: true,
        created_at: now,
        updated_at: now
      })
    }
  }
}

// Minimal, dependency-free re-implementation of GroupRole.setupSystemRoles
// (api/models/GroupRole.js) for use inside a standalone knex migration, which
// doesn't have access to Sails/Bookshelf globals. Returns the new space's
// Coordinator groups_roles.id.
async function setupSystemRoles (trx, groupId) {
  const responsibilityRows = await trx('responsibilities').where({ type: 'system' })
  const responsibilityIdByTitle = {}
  responsibilityRows.forEach(r => { responsibilityIdByTitle[r.title] = r.id })

  const now = new Date()
  let coordinatorRoleId = null

  for (const roleDef of SYSTEM_ROLES) {
    let role = await trx('groups_roles').where({ group_id: groupId, name: roleDef.name, type: 'system' }).first()
    if (!role) {
      const [inserted] = await trx('groups_roles').insert({
        group_id: groupId,
        name: roleDef.name,
        emoji: roleDef.emoji,
        description: roleDef.description,
        type: 'system',
        active: true,
        created_at: now,
        updated_at: now
      }).returning('*')
      role = inserted
    }
    if (roleDef.name === 'Coordinator') coordinatorRoleId = role.id

    for (const title of roleDef.responsibilities) {
      const responsibilityId = responsibilityIdByTitle[title]
      if (!responsibilityId) continue
      const exists = await trx('group_roles_responsibilities')
        .where({ group_role_id: role.id, responsibility_id: responsibilityId }).first()
      if (!exists) {
        await trx('group_roles_responsibilities').insert({ group_role_id: role.id, responsibility_id: responsibilityId })
      }
    }
  }

  return coordinatorRoleId
}

async function getGeneralTagId (knex) {
  const tag = await knex('tags').where({ name: 'general' }).first()
  return tag ? tag.id : null
}

async function newAccessCode (trx) {
  // Mirrors Group.getNewAccessCode() (api/models/Group.js) — an 8-char code,
  // regenerated on the rare collision.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = ''
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
    const existing = await trx('groups').where({ access_code: code }).first()
    if (!existing) return code
  }
  throw new Error('Could not generate a unique group access code')
}

function slugify (name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'space'
}

async function uniqueSlug (trx, parentSlug, name) {
  const base = `${parentSlug}-${slugify(name)}`.slice(0, 255)
  let slug = base
  let suffix = 2
  while (await trx('groups').where({ slug }).first()) {
    slug = `${base}-${suffix}`
    suffix += 1
  }
  return slug
}

function uuidv4 () {
  // Avoid an external dependency inside the migration — RFC4122 v4 via crypto.
  return require('crypto').randomUUID()
}

// ---------------------------------------------------------------------------
// Step 8b — Backfill group_views_users for all existing members of every
// pre-existing (non-space) group's Main Space views.
// ---------------------------------------------------------------------------

async function backfillGroupViewsUsers (knex) {
  await knex.raw(`
    INSERT INTO group_views_users (view_id, user_id, new_post_count, last_read_post_id, created_at, updated_at)
    SELECT gv.id, gm.user_id, 0,
      (SELECT max(gp.post_id) FROM groups_posts gp WHERE gp.group_id = gv.group_id),
      now(), now()
    FROM group_views gv
    JOIN group_memberships gm ON gm.group_id = gv.group_id AND gm.active = true
    WHERE NOT EXISTS (
      SELECT 1 FROM group_views_users gvu WHERE gvu.view_id = gv.id AND gvu.user_id = gm.user_id
    )
  `)
}

// ---------------------------------------------------------------------------
// Step 9 — #general cleanup — DEFERRED to Phase 6 final cleanup migration.
// Deletes all posts_tags rows for the #general tag globally. Not included in
// `up` because it cannot be reversed and would break dev rollback.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step 10 — groups.home_route
// ---------------------------------------------------------------------------

async function updateHomeRoutes (knex) {
  const groups = await knex('groups').select('id')
  for (const group of groups) {
    const homeView = await knex('group_views').where({ group_id: group.id, order: 0 }).first()
    const homeRoute = computeHomeRoutePath(homeView)
    await knex('groups').where({ id: group.id }).update({ home_route: homeRoute })
  }
}

function computeHomeRoutePath (view) {
  if (!view) return '/all'
  switch (view.type) {
    case 'custom': return `/custom/${view.id}`
    case 'collection': return `/collection/${view.id}`
    case 'all': return '/all'
    default: return `/${view.type}`
  }
}

// ---------------------------------------------------------------------------
// `down` — development rollback (reverse of `up`, best-effort)
// ---------------------------------------------------------------------------

async function rollbackMigratedSpaces (knex) {
  const spaces = await knex('groups')
    .where({ type: 'space' })
    .whereNotNull('parent_id')
    .select('id', 'parent_id', 'track_id', 'funding_round_id')

  for (const space of spaces) {
    await knex.transaction(trx => rollbackSpace(trx, space))
  }
}

async function rollbackSpace (trx, space) {
  await rollbackSpaceSideEffects(trx, space)
  await deleteSpaceRolesAndMemberships(trx, space.id)
  // Cascades: group_views on this space, menu entries (linked_group_id), etc.
  await trx('groups').where({ id: space.id }).delete()
}

async function rollbackSpaceSideEffects (trx, space) {
  if (space.track_id) {
    await trx('tracks').where({ id: space.track_id }).update({ group_id: null })
    return
  }

  if (space.funding_round_id) {
    await trx('funding_rounds').where({ id: space.funding_round_id }).update({ group_id: space.parent_id })
    await trx('groups_posts')
      .where({ group_id: space.id })
      .whereIn('post_id', trx('funding_rounds_posts')
        .where({ funding_round_id: space.funding_round_id })
        .select('post_id'))
      .delete()
    return
  }

  // Chat (and other non-track/round) child spaces — move posts back to parent
  await trx('groups_posts')
    .where({ group_id: space.id })
    .update({ group_id: space.parent_id })
}

async function deleteSpaceRolesAndMemberships (trx, spaceId) {
  const roleIds = await trx('groups_roles').where({ group_id: spaceId }).pluck('id')
  if (roleIds.length > 0) {
    await trx('group_roles_responsibilities').whereIn('group_role_id', roleIds).delete()
    await trx('group_memberships_group_roles').where({ group_id: spaceId }).delete()
    await trx('groups_roles').where({ group_id: spaceId }).delete()
  }
  await trx('group_memberships').where({ group_id: spaceId }).delete()
}

async function deleteMainGroupViews (knex) {
  const parentGroupIds = knex('groups').whereRaw("type IS DISTINCT FROM 'space'").select('id')
  // Cascades collection_posts + group_views_users for these views
  await knex('group_views').whereIn('group_id', parentGroupIds).delete()
}

async function revertMigrationDefaults (knex) {
  await knex.raw(`
    UPDATE groups
    SET settings = settings - 'showPostNoticesInChat'
    WHERE settings ? 'showPostNoticesInChat'
  `)
}

async function revertHomeRoutes (knex) {
  const groups = await knex('groups').whereRaw("type IS DISTINCT FROM 'space'").select('id')
  for (const group of groups) {
    const homeRoute = await computeLegacyHomeRoute(knex, group.id)
    await knex('groups').where({ id: group.id }).update({ home_route: homeRoute })
  }
}

async function computeLegacyHomeRoute (knex, groupId) {
  const widgets = await knex('context_widgets').where({ group_id: groupId })
  const homeWidget = widgets.find(w => w.type === 'home')
  const homeChild = homeWidget ? widgets.find(w => w.parent_id === homeWidget.id) : null
  if (!homeChild) return '/stream'

  if (homeChild.view) {
    return homeChild.view === 'stream' ? '/stream' : `/${homeChild.view}`
  }
  if (homeChild.view_chat_id) {
    const chat = await knex('tags').where({ id: homeChild.view_chat_id }).first()
    return `/chat/${chat?.name || 'general'}`
  }
  if (homeChild.custom_view_id) return `/custom/${homeChild.custom_view_id}`
  if (homeChild.view_track_id) return `/tracks/${homeChild.view_track_id}`
  if (homeChild.view_funding_round_id) return `/funding-rounds/${homeChild.view_funding_round_id}`
  return '/stream'
}

// ---------------------------------------------------------------------------
// Step 11 — Post-migration verification (run manually, not part of `up()` —
// these are assertions for a human to check on a staging copy, not something
// that should abort/rollback a partially-successful production migration).
// ---------------------------------------------------------------------------
//
// -- Every group/space has a home view (order = 0):
// select g.id from groups g left join group_views gv on gv.group_id = g.id and gv.order = 0 where gv.id is null;
//
// -- Every space has a parent:
// select id from groups where type = 'space' and parent_id is null;
//
// -- Every space has exactly one menu entry in its parent's menu:
// select linked_group_id, count(*) from group_views where type = 'space' group by linked_group_id having count(*) != 1;
//
// -- Every track/funding-round space is linked back to its source row:
// select id from groups where type = 'space' and track_id is null and funding_round_id is null
//   and id not in (select linked_group_id from group_views where type = 'space');
//
// -- No top-level group has type = 'space':
// select id from groups where parent_id is null and type = 'space';
//
// -- Every active membership has a group_views_users row for every view in its group:
// select gm.group_id, gm.user_id, gv.id as missing_view_id
//   from group_memberships gm
//   join group_views gv on gv.group_id = gm.group_id
//   left join group_views_users gvu on gvu.view_id = gv.id and gvu.user_id = gm.user_id
//   where gm.active = true and gvu.id is null;
