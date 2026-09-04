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
// are intentionally NOT dropped here — tracks_posts / tracks_users cleanup is
// in 20260713120000_spaces_cleanup.js; remaining destructive cleanup is
// deferred until Spaces & Views is verified in production (see spec Phase 6).
//
// Step 9 (#general posts_tags cleanup) is also deferred to that Phase 6
// cleanup migration — it is destructive and not reversible, so it is
// intentionally omitted here to keep dev rollback workable.
//
// `down` is provided for development: roll back, fix `up`, and re-run.
// It is NOT safe for production once real post-migration activity exists.

/** Route path for groups.home_route from a group_views knex row (snake_case). */
function homeRoutePathForViewRow (view) {
  if (!view) return '/all'
  switch (view.type) {
    case 'post':
      return view.post_id ? `/post/${view.post_id}` : '/post'
    case 'member':
      return view.user_id ? `/members/${view.user_id}` : '/members'
    case 'custom':
      return `/custom/${view.id}`
    case 'collection':
      return `/collection/${view.id}`
    case 'space-collection':
      return `/space-collection/${view.id}`
    default:
      return view.type ? `/${view.type}` : '/all'
  }
}

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
  'related-groups': 'related-groups',
  groups: 'related-groups'
}
const SKIPPED_WIDGET_VIEWS = ['all-topics', 'setup']

// Legacy menu folders become a text section header, then their children follow.
const STRUCTURAL_FOLDER_TYPES = ['chats', 'auto-view', 'custom-views']
const SECTION_LABEL_BY_WIDGET_TYPE = {
  'auto-view': 'Common Views',
  'custom-views': 'Custom Views',
  chats: 'Chats'
}

// Default translation keys for system views created without a legacy widget title.
const DEFAULT_VIEW_NAME_BY_TYPE = {
  welcome: 'view-welcome',
  chat: 'view-chat',
  members: 'view-members',
  all: 'view-all',
  map: 'view-map',
  events: 'view-events',
  discussions: 'view-discussions',
  proposals: 'view-proposals',
  resources: 'view-resources',
  'requests-and-offers': 'view-requests-and-offers',
  projects: 'view-projects',
  about: 'view-about',
  'related-groups': 'view-related-groups',
  'track-actions': 'view-track-actions',
  'funding-round-submissions': 'view-funding-round-submissions',
  'space-collection': 'view-space-collection'
}

/** Convert legacy widget-xxx title keys to view-xxx translation keys. */
function viewNameFromWidgetTitle (title) {
  if (!title) return null
  if (title.startsWith('widget-')) return `view-${title.slice(7)}`
  return title
}

/** Resolve the stored group_views.name for a view row. */
function resolveViewName ({ name, type }) {
  if (type === 'related-groups') return 'view-related-groups'
  if (type === 'all') return 'view-all'
  return viewNameFromWidgetTitle(name) || DEFAULT_VIEW_NAME_BY_TYPE[type] || name || null
}

/** Display name for legacy folder/section labels (auto-view, custom-views, chats). */
function sectionLabelForWidget (widget) {
  if (SECTION_LABEL_BY_WIDGET_TYPE[widget.type]) {
    return SECTION_LABEL_BY_WIDGET_TYPE[widget.type]
  }
  if (widget.title === 'widget-auto-view') return 'Common Views'
  if (widget.title === 'widget-custom-views') return 'Custom Views'
  if (widget.title === 'widget-chats') return 'Chats'
  return resolveViewName({ name: widget.title, type: 'text' })
}

exports.up = async function (knex) {
  console.log('[up] 1/7 applying migration defaults…')
  await applyMigrationDefaults(knex)
  console.log('[up] 2/7 migrating main space views…')
  await migrateMainSpaceViews(knex)
  console.log('[up] 3/7 migrating tracks…')
  await migrateTracks(knex)
  console.log('[up] 4/7 migrating funding rounds…')
  await migrateFundingRounds(knex)
  console.log('[up] 5/7 backfilling space collections…')
  await backfillSpaceCollections(knex)
  console.log('[up] 6/7 backfilling group_views_users…')
  await backfillGroupViewsUsers(knex)
  console.log('[up] 7/7 updating home routes…')
  await updateHomeRoutes(knex)
  console.log('[up] done.')
}

exports.down = async function (knex) {
  // Development rollback — undo everything `up` created so the migration can
  // be re-run from context_widgets. Does NOT restore #general posts_tags
  // (that step is deferred to Phase 6 cleanup; see file header).
  //
  // IMPORTANT: explicit deletes of group_views_users / collections_posts (view_id rows)
  // come before the parent-table deletes to avoid slow FK-cascade row-by-row
  // processing inside Postgres.
  console.log('[down] 1/6 purging group_views_users…')
  await knex('group_views_users').delete()
  console.log('[down] 2/6 purging collections_posts view links…')
  await knex('collections_posts').whereNotNull('view_id').delete()
  console.log('[down] 3/6 rolling back migrated spaces…')
  await rollbackMigratedSpaces(knex)
  console.log('[down] 4/6 deleting main-space group_views…')
  await deleteMainGroupViews(knex)
  console.log('[down] 5/6 reverting home routes…')
  await revertHomeRoutes(knex)
  console.log('[down] 6/6 reverting migration defaults…')
  await revertMigrationDefaults(knex)
  console.log('[down] data migration complete.')
  console.log('[down] note: `yarn rollback` rolls back the whole batch — knex will next run schema migrations (slow, little output). For one file use `yarn rollback:specific <filename>`.')
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

  // Fetch all already-migrated group ids in one query for fast idempotency check.
  const migratedGroupIds = new Set(
    await knex('group_views').distinct('group_id').pluck('group_id')
  )

  const todo = groups.filter(g => !migratedGroupIds.has(g.id))
  console.log(`[up]   ${groups.length} groups total, ${todo.length} need migration`)

  for (let i = 0; i < todo.length; i++) {
    const group = todo[i]
    if (i > 0 && i % 100 === 0) console.log(`[up]   migrated ${i}/${todo.length} groups…`)
    await knex.transaction(trx => migrateGroupMenu(trx, group, generalTagId))
  }
}

async function migrateGroupMenu (trx, group, generalTagId) {
  const widgets = await trx('context_widgets').where({ group_id: group.id })
  if (widgets.length === 0) {
    // No legacy menu at all — seed the same minimal default a brand new space gets.
    await insertGroupViews(trx, group.id, [{ type: 'all' }, { type: 'chat' }, { type: 'members' }])
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

  const emitHomeChat = () => ({ view: { type: 'chat', name: 'view-chat' } })

  const emitChatWidget = widget => {
    const isGeneral = generalTagId && widget.view_chat_id === generalTagId
    const isHome = homeChild && widget.id === homeChild.id
    if (isGeneral || isHome) return emitHomeChat()
    return { space: { kind: 'chat', widget } }
  }

  const emitWidget = widget => {
    // widget-home is structural only — its child becomes the home view (order 0).
    if (widget.type === 'home') return null
    if (widget.view_chat_id) return emitChatWidget(widget)
    if (widget.view_track_id) return { space: { kind: 'track', widget } }
    if (widget.view_funding_round_id) return { space: { kind: 'fundingRound', widget } }
    if (widget.custom_view_id) return { customViewWidget: widget }
    if (widget.view_post_id) return { view: { type: 'post', post_id: widget.view_post_id, name: widget.title, icon: widget.icon } }
    if (widget.view_group_id) return { view: { type: 'group', linked_group_id: widget.view_group_id, name: widget.title, icon: widget.icon } }
    if (widget.view_user_id) return { view: { type: 'member', user_id: widget.view_user_id, name: widget.title, icon: widget.icon } }
    if (widget.type === 'container') {
      const children = childrenOf(widget.id)
      if (children.length === 0) return null
      return {
        view: { type: 'text', name: sectionLabelForWidget(widget), icon: widget.icon },
        children
      }
    }
    if (widget.view && SKIPPED_WIDGET_VIEWS.includes(widget.view)) return null
    if (widget.view === 'tracks' || widget.view === 'funding-rounds') {
      return {
        view: {
          type: 'space-collection',
          name: viewNameFromWidgetTitle(widget.title),
          icon: widget.view === 'funding-rounds' ? 'BadgeDollarSign' : 'Shapes',
          settings: JSON.stringify({ spaceIds: [], migratedFrom: widget.view })
        }
      }
    }
    if (widget.view && SYSTEM_VIEW_TYPE_BY_WIDGET_VIEW[widget.view]) {
      return { view: { type: SYSTEM_VIEW_TYPE_BY_WIDGET_VIEW[widget.view], name: widget.title, icon: widget.icon } }
    }
    // Unrecognized widget (e.g. a stray 'chats' folder with no children, or a
    // 'home' node reached directly) — nothing to emit for it directly.
    return null
  }

  // Walk a widget, expanding structural folders (chats, auto-view, custom-views).
  const walk = widget => {
    if (widget.type === 'home') {
      for (const child of childrenOf(widget.id)) walk(child)
      return
    }

    if (STRUCTURAL_FOLDER_TYPES.includes(widget.type)) {
      const children = childrenOf(widget.id)
      if (children.length > 0) {
        emitted.push({ view: { type: 'text', name: sectionLabelForWidget(widget) } })
        for (const child of children) walk(child)
      }
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
    await insertGroupViews(trx, group.id, [{ type: 'all' }, { type: 'chat' }, { type: 'members' }])
    return
  }

  // Materialize: plain views get inserted directly; spaces get created (with
  // their own default views) and a type='space' menu entry inserted here;
  // collection views are inserted as plain views, with their collections_posts
  // view links migrated afterwards once the row (and its real id) exists.
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
      await insertCollectionsPostForView(trx, {
        viewId: view.id,
        postId: lp.post_id,
        userId: lp.user_id,
        order: lp.order,
        now
      })
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
    // step to migrate collections_posts view links once the view has a real id.
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
    accessibility: 2,
    settings: '{}',
    icon: 'Shapes',
    access_code: await newAccessCode(trx),
    calendar_token: uuidv4(),
    created_at: now,
    updated_at: now
  }).returning('id')
  const spaceId = space.id ?? space

  await trx('tracks').where({ id: track.id }).update({ group_id: spaceId })

  const views = await insertGroupViews(trx, spaceId, [
    { type: 'track-actions' },
    { type: 'chat' },
    { type: 'members' },
    { type: 'welcome', page_content: track.welcome_message }
  ])
  const trackActionsView = views.find(v => v.type === 'track-actions')

  const trackPosts = await trx('tracks_posts').where({ track_id: track.id }).orderBy('sort_order', 'asc')
  for (const tp of trackPosts) {
    const post = await trx('posts').where({ id: tp.post_id }).select('user_id').first()
    await insertCollectionsPostForView(trx, {
      viewId: trackActionsView.id,
      postId: tp.post_id,
      userId: post?.user_id || parentGroup.created_by_id,
      order: tp.sort_order,
      now
    })
  }

  // Reassociate action posts from the parent group to this track space.
  // Collection ordering alone is not enough — posts must live on the space
  // (same pattern as chat / funding-round chat post moves above).
  const trackPostIds = trackPosts.map(tp => tp.post_id)
  if (trackPostIds.length > 0) {
    await trx('groups_posts')
      .where({ group_id: parentGroup.id })
      .whereIn('post_id', trackPostIds)
      .update({ group_id: spaceId })
  }

  await migrateSpaceMembers(trx, spaceId, parentGroup.id, async () => {
    // Join space = enroll; preserve historical enrollment time on membership.created_at.
    // Completion stays in settings.completedAt.
    const trackUsers = await trx('tracks_users')
      .where({ track_id: track.id })
      .whereNotNull('enrolled_at')
    return trackUsers.map(tu => ({
      user_id: tu.user_id,
      createdAt: tu.enrolled_at,
      settingsPatch: tu.completed_at ? { completedAt: tu.completed_at } : {}
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

/**
 * Ensure submission (or chat) posts are on the funding-round space.
 * Prefer moving a parent groups_posts row; if none exists (join-table-only /
 * orphaned posts), INSERT onto the space. Idempotent.
 */
async function ensurePostsOnSpace (trx, spaceId, parentGroupId, postIds) {
  if (!postIds.length) return
  for (const postId of postIds) {
    const onSpace = await trx('groups_posts').where({ group_id: spaceId, post_id: postId }).first()
    if (onSpace) continue

    const updated = await trx('groups_posts')
      .where({ group_id: parentGroupId, post_id: postId })
      .update({ group_id: spaceId })
    if (updated) continue

    await trx('groups_posts').insert({ group_id: spaceId, post_id: postId })
  }
}

async function ensureFundingRoundPostsOnSpace (trx, spaceId, parentGroupId, round) {
  const submissionPostIds = await trx('funding_rounds_posts')
    .where({ funding_round_id: round.id })
    .pluck('post_id')
  await ensurePostsOnSpace(trx, spaceId, parentGroupId, submissionPostIds)

  // Funding-round chat posts (hidden topic ‡funding_round_<id>)
  const fundingRoundChatTag = await trx('tags').where({ name: `‡funding_round_${round.id}` }).first()
  if (!fundingRoundChatTag) return fundingRoundChatTag

  const taggedChatPostIds = await trx('posts_tags')
    .join('posts', 'posts.id', 'posts_tags.post_id')
    .where('posts_tags.tag_id', fundingRoundChatTag.id)
    .where('posts.type', 'chat')
    .pluck('posts.id')
  await ensurePostsOnSpace(trx, spaceId, parentGroupId, taggedChatPostIds)
  return fundingRoundChatTag
}

async function createFundingRoundSpace (trx, parentGroup, fundingRoundId) {
  const round = await trx('funding_rounds').where({ id: fundingRoundId }).first()
  if (!round) return null

  // Unlike tracks, funding_rounds.group_id was NOT NULL before this migration
  // (it's the round's pre-existing parent group), so "already migrated" has to
  // be detected via the new space itself rather than a null check.
  const existingSpace = await trx('groups').where({ funding_round_id: round.id, type: 'space' }).first()
  if (existingSpace) {
    // Space may have been created before posts were associated — repair idempotently.
    const parentId = existingSpace.parent_id || parentGroup.id
    await ensureFundingRoundPostsOnSpace(trx, existingSpace.id, parentId, round)
    return existingSpace.id
  }

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
    accessibility: 2,
    settings: '{ "show_welcome_page": true }',
    icon: 'BadgeDollarSign',
    access_code: await newAccessCode(trx),
    calendar_token: uuidv4(),
    created_at: now,
    updated_at: now
  }).returning('id')
  const spaceId = space.id ?? space

  await trx('funding_rounds').where({ id: round.id }).update({ group_id: spaceId })

  const views = await insertGroupViews(trx, spaceId, [
    { type: 'funding-round-submissions' },
    { type: 'chat' },
    { type: 'members' },
    { type: 'welcome' }
  ])
  const chatView = views.find(v => v.type === 'chat')

  const fundingRoundChatTag = await ensureFundingRoundPostsOnSpace(trx, spaceId, parentGroup.id, round)

  await migrateSpaceMembers(trx, spaceId, parentGroup.id, async () => {
    const roundUsers = await trx('funding_rounds_users').where({ funding_round_id: round.id })
    const tagFollowsByUserId = {}
    if (fundingRoundChatTag) {
      const follows = await trx('tag_follows')
        .where({ group_id: parentGroup.id, tag_id: fundingRoundChatTag.id })
      for (const follow of follows) {
        tagFollowsByUserId[follow.user_id] = follow
      }
    }
    return roundUsers.map(ru => {
      const follow = tagFollowsByUserId[ru.user_id]
      return {
        user_id: ru.user_id,
        settingsPatch: { tokensRemaining: ru.tokens_remaining },
        ...(follow && chatView && {
          newPostCount: follow.new_post_count,
          lastReadPostId: follow.last_read_post_id,
          viewId: chatView.id
        })
      }
    })
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
    accessibility: 2,
    settings: '{}',
    icon: 'MessageCircleMore',
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

/** Idempotent insert of a view-linked collections_posts row (partial unique index is not usable with knex onConflict). */
async function insertCollectionsPostForView (trx, { viewId, postId, userId, order, now }) {
  const existing = await trx('collections_posts').where({ view_id: viewId, post_id: postId }).first()
  if (existing) return
  await trx('collections_posts').insert({
    view_id: viewId,
    post_id: postId,
    user_id: userId,
    order: order || 0,
    created_at: now,
    updated_at: now
  })
}

async function insertGroupViews (trx, groupId, views) {
  const now = new Date()
  const rows = views.map((v, i) => {
    const { name, type, ...rest } = v
    return {
      group_id: groupId,
      order: i,
      created_at: now,
      updated_at: now,
      type,
      ...rest,
      name: resolveViewName({ name, type })
    }
  })
  return trx('group_views').insert(rows).returning('*')
}

/**
 * Fill space-collection settings.spaceIds after track/round spaces exist.
 * Skips rows whose spaceIds is already non-empty so re-runs stay idempotent.
 */
async function backfillSpaceCollections (knex) {
  const views = await knex('group_views').where({ type: 'space-collection' })
  const now = new Date()
  for (const view of views) {
    const settings = typeof view.settings === 'string'
      ? JSON.parse(view.settings || '{}')
      : (view.settings || {})
    if (Array.isArray(settings.spaceIds) && settings.spaceIds.length > 0) continue

    const migratedFrom = settings.migratedFrom
    if (migratedFrom !== 'tracks' && migratedFrom !== 'funding-rounds') continue

    let query = knex('groups').where({ parent_id: view.group_id, type: 'space' })
    if (migratedFrom === 'tracks') {
      query = query.whereNotNull('track_id')
    } else {
      query = query.whereNotNull('funding_round_id')
    }
    const spaces = await query.orderBy('name', 'asc').select('id')
    await knex('group_views').where({ id: view.id }).update({
      settings: JSON.stringify({ ...settings, spaceIds: spaces.map(space => String(space.id)) }),
      updated_at: now
    })
  }
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
        settings: JSON.stringify({ ...(parentMembership.settings || {}), ...(member.settingsPatch || {}) }),
        created_at: member.createdAt || now,
        updated_at: now
      })
    } else if (member.settingsPatch && Object.keys(member.settingsPatch).length > 0) {
      // Membership may already exist (e.g. coordinator grant on a prior partial
      // run) — still merge completion settings onto it.
      await trx('group_memberships')
        .where({ id: existing.id })
        .update({
          active: true,
          settings: JSON.stringify({ ...(existing.settings || {}), ...member.settingsPatch }),
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

  // Give parent Coordinators membership in the new space so they can see its
  // content. Roles are NOT copied onto the space — spaces inherit role
  // assignments from the parent at lookup time.
  await grantParentCoordinatorsAccess(trx, spaceId, parentGroupId)
}

async function grantParentCoordinatorsAccess (trx, spaceId, parentGroupId) {
  const parentCoordinatorRole = await trx('groups_roles').where({ group_id: parentGroupId, name: 'Coordinator', type: 'system' }).first()
  if (!parentCoordinatorRole) return

  const parentCoordinators = await trx('group_memberships_group_roles')
    .where({ group_role_id: parentCoordinatorRole.id, active: true })
    .pluck('user_id')

  const now = new Date()
  const views = await trx('group_views').where({ group_id: spaceId })

  for (const userId of parentCoordinators) {
    // Membership is required for content visibility (postFilter); roles come from the parent.
    const parentMembership = await trx('group_memberships')
      .where({ group_id: parentGroupId, user_id: userId, active: true })
      .first()
    if (parentMembership) {
      const existingMembership = await trx('group_memberships').where({ group_id: spaceId, user_id: userId }).first()
      if (!existingMembership) {
        await trx('group_memberships').insert({
          group_id: spaceId,
          user_id: userId,
          active: true,
          settings: JSON.stringify(parentMembership.settings || {}),
          created_at: now,
          updated_at: now
        })
      }
      for (const view of views) {
        await trx('group_views_users').insert({
          view_id: view.id,
          user_id: userId,
          new_post_count: 0,
          last_read_post_id: null,
          created_at: now,
          updated_at: now
        }).onConflict(['view_id', 'user_id']).ignore()
      }
    }
  }
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
  const generalTagId = await getGeneralTagId(knex)

  // Pre-compute the max post_id per group once to avoid a correlated subquery
  // for every (view, member) pair — that would be extremely slow at scale.
  // Main-space chat views (#general / home chat) preserve unread state from
  // tag_follows; all other views start at 0 with last_read at the latest post.
  const result = await knex.raw(`
    INSERT INTO group_views_users (view_id, user_id, new_post_count, last_read_post_id, created_at, updated_at)
    SELECT gv.id, gm.user_id,
      CASE WHEN gv.type = 'chat' THEN COALESCE(tf.new_post_count, 0) ELSE 0 END,
      CASE WHEN gv.type = 'chat'
        THEN COALESCE(tf.last_read_post_id, max_posts.max_post_id)
        ELSE max_posts.max_post_id
      END,
      now(), now()
    FROM group_views gv
    JOIN group_memberships gm ON gm.group_id = gv.group_id AND gm.active = true
    LEFT JOIN (
      SELECT group_id, max(post_id) AS max_post_id FROM groups_posts GROUP BY group_id
    ) max_posts ON max_posts.group_id = gv.group_id
    LEFT JOIN tag_follows tf ON gv.type = 'chat'
      AND tf.group_id = gv.group_id
      AND tf.user_id = gm.user_id
      AND tf.tag_id = ?
    WHERE NOT EXISTS (
      SELECT 1 FROM group_views_users gvu WHERE gvu.view_id = gv.id AND gvu.user_id = gm.user_id
    )
  `, [generalTagId])
  console.log(`[up]   inserted ${result.rowCount ?? '?'} group_views_users rows`)
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
  // Load all order-0 views in one query, then bulk-update.
  const homeViews = await knex('group_views').where({ order: 0 })
  const updates = homeViews.map(view => ({ id: view.group_id, home_route: homeRoutePathForViewRow(view) }))
  if (updates.length > 0) await bulkUpdateGroupsHomeRoutes(knex, updates)
}

// ---------------------------------------------------------------------------
// `down` — development rollback (reverse of `up`, best-effort)
// Bulk SQL where possible — this runs often during dev iteration.
// ---------------------------------------------------------------------------

async function rollbackMigratedSpaces (knex) {
  const spaceIds = await knex('groups')
    .where({ type: 'space' })
    .whereNotNull('parent_id')
    .pluck('id')

  console.log(`[down]   found ${spaceIds.length} spaces to roll back`)
  if (spaceIds.length === 0) return

  const chunkSize = 25
  for (let i = 0; i < spaceIds.length; i += chunkSize) {
    const chunk = spaceIds.slice(i, i + chunkSize)
    const end = Math.min(i + chunkSize, spaceIds.length)
    console.log(`[down]   rolling back spaces ${i + 1}-${end} of ${spaceIds.length}…`)

    await knex.transaction(async trx => {
      const idPlaceholders = chunk.map(() => '?').join(', ')

      await trx('tracks').whereIn('group_id', chunk).update({ group_id: null })

      // Funding-round submissions were inserted as *new* groups_posts on the
      // space (parent may still have its own row) — drop the space copies.
      await trx.raw(`
        UPDATE funding_rounds fr
        SET group_id = g.parent_id
        FROM groups g
        WHERE g.funding_round_id = fr.id
          AND g.id IN (${idPlaceholders})
          AND g.type = 'space'
          AND g.parent_id IS NOT NULL
      `, chunk)
      // Move funding-round submission posts back to the parent group.
      await trx.raw(`
        UPDATE groups_posts gp
        SET group_id = g.parent_id
        FROM groups g, funding_rounds_posts frp
        WHERE gp.group_id = g.id
          AND g.id IN (${idPlaceholders})
          AND g.type = 'space'
          AND g.parent_id IS NOT NULL
          AND g.funding_round_id = frp.funding_round_id
          AND gp.post_id = frp.post_id
      `, chunk)
      // Move every remaining space groups_posts row back to the parent.
      // Chat / FR-chat / post-migration leftovers used to be handled with
      // narrow filters; anything missed left dangling FKs that only failed at
      // COMMIT (groups_posts_group_id_foreign is DEFERRABLE INITIALLY DEFERRED).
      // Drop space copies that would collide with an existing parent row first.
      await trx.raw(`
        DELETE FROM groups_posts gp
        USING groups g
        WHERE gp.group_id = g.id
          AND g.id IN (${idPlaceholders})
          AND g.type = 'space'
          AND g.parent_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM groups_posts parent_gp
            WHERE parent_gp.group_id = g.parent_id
              AND parent_gp.post_id = gp.post_id
          )
      `, chunk)
      // Move track action posts back to the parent group before deleting the space.
      await trx.raw(`
        UPDATE groups_posts gp
        SET group_id = g.parent_id
        FROM groups g, tracks_posts tp
        WHERE gp.group_id = g.id
          AND g.id IN (${idPlaceholders})
          AND g.type = 'space'
          AND g.parent_id IS NOT NULL
          AND g.track_id IS NOT NULL
          AND g.track_id = tp.track_id
          AND gp.post_id = tp.post_id
      `, chunk)
      await trx.raw(`
        UPDATE groups_posts gp
        SET group_id = g.parent_id
        FROM groups g
        WHERE gp.group_id = g.id
          AND g.id IN (${idPlaceholders})
          AND g.type = 'space'
          AND g.parent_id IS NOT NULL
      `, chunk)

      const roleIds = await trx('groups_roles').whereIn('group_id', chunk).pluck('id')
      if (roleIds.length > 0) {
        await trx('group_roles_responsibilities').whereIn('group_role_id', roleIds).delete()
        await trx('group_memberships_group_roles').whereIn('group_id', chunk).delete()
        await trx('groups_roles').whereIn('group_id', chunk).delete()
      }
      await trx('group_memberships').whereIn('group_id', chunk).delete()

      // Wipe remaining non-CASCADE FK rows that point at these spaces.
      // Deferred FKs (activities, tag_follows, …) only fail at outer COMMIT —
      // cascade-covered tables (group_views, context_widgets, stripe_products)
      // and SET NULL (stripe_logs) are fine to leave alone. moderation_actions
      // cascade is not enough — their join tables are cleaned just before the
      // groups delete.
      const activityIds = await trx('activities').whereIn('group_id', chunk).pluck('id')
      if (activityIds.length > 0) {
        await trx('notifications').whereIn('activity_id', activityIds).delete()
        await trx('activities').whereIn('id', activityIds).delete()
      }
      await trx('activities').whereIn('other_group_id', chunk).update({ other_group_id: null })
      const collectionIds = await trx('collections').whereIn('group_id', chunk).pluck('id')
      if (collectionIds.length > 0) {
        await trx('collections_posts').whereIn('collection_id', collectionIds).delete()
        await trx('collections').whereIn('id', collectionIds).delete()
      }
      await trx('content_access').where(builder => {
        builder.whereIn('group_id', chunk).orWhereIn('granted_by_group_id', chunk)
      }).delete()
      const customViewIds = await trx('custom_views').whereIn('group_id', chunk).pluck('id')
      if (customViewIds.length > 0) {
        await trx('custom_view_topics').whereIn('custom_view_id', customViewIds).delete()
        await trx('custom_views').whereIn('id', customViewIds).delete()
      }
      await trx('drafts').whereIn('group_id', chunk).delete()
      await trx('group_extensions').whereIn('group_id', chunk).delete()
      await trx('group_invites').whereIn('group_id', chunk).delete()
      await trx('group_join_questions_answers').whereIn('group_id', chunk).delete()
      await trx('group_join_questions').whereIn('group_id', chunk).delete()
      await trx('group_relationship_invites').where(builder => {
        builder.whereIn('from_group_id', chunk).orWhereIn('to_group_id', chunk)
      }).delete()
      await trx('group_relationships').where(builder => {
        builder.whereIn('parent_group_id', chunk).orWhereIn('child_group_id', chunk)
      }).delete()
      await trx('group_to_group_join_questions').whereIn('group_id', chunk).delete()
      await trx('group_widgets').whereIn('group_id', chunk).delete()
      await trx('groups_agreements').whereIn('group_id', chunk).delete()
      await trx('groups_suggested_skills').whereIn('group_id', chunk).delete()
      await trx('groups_tags').whereIn('group_id', chunk).delete()
      await trx('groups_tracks').whereIn('group_id', chunk).delete()
      await trx('join_requests').whereIn('group_id', chunk).delete()
      const spaceResponsibilityIds = await trx('responsibilities').whereIn('group_id', chunk).pluck('id')
      if (spaceResponsibilityIds.length > 0) {
        await trx('group_roles_responsibilities').whereIn('responsibility_id', spaceResponsibilityIds).delete()
        await trx('responsibilities').whereIn('id', spaceResponsibilityIds).delete()
      }
      await trx('tag_follows').whereIn('group_id', chunk).delete()
      await trx('users_groups_agreements').whereIn('group_id', chunk).delete()
      await trx('zapier_triggers_groups').whereIn('group_id', chunk).delete()
      // Explicit (also CASCADE) — avoids slow row-by-row cascade on large menus.
      await trx('group_views').where(builder => {
        builder.whereIn('group_id', chunk).orWhereIn('linked_group_id', chunk)
      }).delete()

      // moderation_actions.group_id is ON DELETE CASCADE, but the join tables
      // that hang off those actions are not — delete them first or group
      // delete fails with moderation_actions_platform_agreements_…_for.
      const moderationActionIds = await trx('moderation_actions').whereIn('group_id', chunk).pluck('id')
      if (moderationActionIds.length > 0) {
        await trx('moderation_actions_platform_agreements').whereIn('moderation_action_id', moderationActionIds).delete()
        await trx('moderation_actions_agreements').whereIn('moderation_action_id', moderationActionIds).delete()
        await trx('moderation_actions').whereIn('id', moderationActionIds).delete()
      }

      await trx('groups').whereIn('id', chunk).delete()
    })
  }
  console.log('[down]   spaces rollback complete')
}

async function deleteMainGroupViews (knex) {
  const parentGroupIds = await knex('groups').whereRaw("type IS DISTINCT FROM 'space'").pluck('id')
  console.log(`[down]   deleting group_views for ${parentGroupIds.length} groups…`)

  const chunkSize = 50
  for (let i = 0; i < parentGroupIds.length; i += chunkSize) {
    const chunk = parentGroupIds.slice(i, i + chunkSize)
    const end = Math.min(i + chunkSize, parentGroupIds.length)
    const deleted = await knex('group_views').whereIn('group_id', chunk).delete()
    console.log(`[down]   deleted ${deleted} group_views (groups ${i + 1}-${end})`)
  }
}

async function revertMigrationDefaults (knex) {
  // Use jsonb_exists — knex treats bare `?` in raw SQL as a bind placeholder.
  await knex.raw(`
    UPDATE groups
    SET settings = settings - 'showPostNoticesInChat'
    WHERE jsonb_exists(settings, 'showPostNoticesInChat')
  `)
}

async function revertHomeRoutes (knex) {
  const groups = await knex('groups').whereRaw("type IS DISTINCT FROM 'space'").select('id')
  if (groups.length === 0) return

  console.log(`[down]   recomputing home_route for ${groups.length} groups…`)
  const groupIds = groups.map(g => g.id)
  const widgets = await knex('context_widgets').whereIn('group_id', groupIds)

  const widgetsByGroupId = {}
  for (const widget of widgets) {
    if (!widgetsByGroupId[widget.group_id]) widgetsByGroupId[widget.group_id] = []
    widgetsByGroupId[widget.group_id].push(widget)
  }

  const chatTagIds = [...new Set(widgets.filter(w => w.view_chat_id).map(w => w.view_chat_id))]
  const tagsById = {}
  if (chatTagIds.length > 0) {
    const tags = await knex('tags').whereIn('id', chatTagIds)
    for (const tag of tags) tagsById[tag.id] = tag
  }

  const updates = groups.map(group => ({
    id: group.id,
    home_route: computeLegacyHomeRouteFromWidgets(widgetsByGroupId[group.id] || [], tagsById)
  }))

  await bulkUpdateGroupsHomeRoutes(knex, updates)
}

function computeLegacyHomeRouteFromWidgets (widgets, tagsById) {
  const homeWidget = widgets.find(w => w.type === 'home')
  const homeChild = homeWidget ? widgets.find(w => w.parent_id === homeWidget.id) : null
  if (!homeChild) return '/stream'

  if (homeChild.view) {
    return homeChild.view === 'stream' ? '/stream' : `/${homeChild.view}`
  }
  if (homeChild.view_chat_id) {
    const chat = tagsById[homeChild.view_chat_id]
    return `/chat/${chat?.name || 'general'}`
  }
  if (homeChild.custom_view_id) return `/custom/${homeChild.custom_view_id}`
  if (homeChild.view_track_id) return `/tracks/${homeChild.view_track_id}`
  if (homeChild.view_funding_round_id) return `/funding-rounds/${homeChild.view_funding_round_id}`
  return '/stream'
}

async function bulkUpdateGroupsHomeRoutes (knex, updates) {
  const chunkSize = 250
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    const placeholders = chunk.map(() => '(?, ?)').join(', ')
    const bindings = chunk.flatMap(row => [row.id, row.home_route])
    await knex.raw(`
      UPDATE groups AS g
      SET home_route = v.home_route
      FROM (VALUES ${placeholders}) AS v(id, home_route)
      WHERE g.id = v.id::bigint
    `, bindings)
  }
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
