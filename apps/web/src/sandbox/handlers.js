import { parseGraphql } from './parseGraphql'
import { sid } from './seed/helpers'

/**
 * Handle a GraphQL operation against the in-memory sandbox seed.
 * Mutates the seed for create/update/delete so subsequent refetches stay consistent.
 */
export function handleGraphql ({ query, variables = {} }, seed) {
  const { kind, operationName, rootField } = parseGraphql(query)

  if (kind === 'mutation') {
    return handleMutation(operationName, rootField, variables, seed)
  }

  return handleQuery(operationName, rootField, variables, seed, query)
}

function handleQuery (operationName, rootField, variables, seed, query) {
  switch (operationName) {
    case 'CheckLogin':
    case 'MeQuery':
    case 'CheckForNewNotifications':
      return { data: { me: presentMe(seed) } }

    case 'FetchForGroup':
    case 'FetchGroupDetails':
    case 'FetchGroupViews':
    case 'FetchContextWidgets':
    case 'FetchGroupSpaces':
    case 'FetchGroupRelationships':
      return { data: { group: presentGroup(seed, findGroup(seed, variables)) } }

    case 'FetchGroupsMenuData':
    case 'FetchGroups':
      return { data: { groups: presentGroupQuerySet(seed, variables) } }

    case 'GroupPostsQuery':
      return presentGroupPostsResponse(seed, variables)

    case 'PostsQuery':
      return { data: { posts: presentPostsForMapOrStream(seed, variables) } }

    case 'FetchPost':
    case 'CommentsQuery':
      return { data: { post: presentPost(seed, findPost(seed, variables.id)) } }

    case 'MessageThreadsQuery':
      return {
        data: {
          me: {
            ...presentMe(seed),
            messageThreads: paginate(seed.messageThreads, variables.first, variables.offset)
          }
        }
      }

    case 'MessageThreadQuery':
      return { data: { messageThread: findThread(seed, variables.id) } }

    case 'MessageThreadMessagesQuery': {
      const thread = findThread(seed, variables.id)
      return {
        data: {
          messageThread: thread
            ? { ...thread, messages: paginate(thread.messages?.items || [], 50, 0) }
            : null
        }
      }
    }

    case 'FetchGroupMembers':
    case 'FetchGroupMembersForGraph':
    case 'FetchRecentlyActiveMembers': {
      const group = findGroup(seed, variables)
      const members = membersForGroup(seed, group)
      return {
        data: {
          group: {
            ...presentGroup(seed, group),
            members: paginate(members, variables.first, variables.offset)
          }
        }
      }
    }

    case 'FetchRoleMemberCounts': {
      const group = findGroup(seed, variables)
      return { data: { group: presentGroup(seed, group) } }
    }

    case 'PeopleAutocompleteQuery':
    case 'PeopleQuery':
      return { data: { people: presentPeopleQuerySet(seed, variables) } }

    case 'FetchTopics':
      return { data: { groupTopics: { items: [], total: 0, hasMore: false } } }

    case 'FetchPlatformAgreements':
      return { data: { platformAgreements: [] } }

    case 'FetchMyTracks':
      return { data: { me: { ...presentMe(seed), tracks: { items: [seed.track], total: 1, hasMore: false } } } }

    case 'FetchGroupTracks':
      return { data: { group: { ...presentGroup(seed, findGroup(seed, variables)), tracks: { items: [seed.track], total: 1, hasMore: false } } } }

    case 'FetchMyDrafts':
      return { data: { myDrafts: [] } }

    case 'FetchDraft':
      return { data: { draft: null } }

    case 'FetchAllMyGroupsSpaces':
      return { data: { me: presentMe(seed) } }

    case 'CheckIsPostPublic':
      return { data: { post: findPost(seed, variables.id) ? { id: variables.id, isPublic: false } : null } }

    case 'CheckIsGroupViewable':
      return { data: { group: findGroup(seed, variables) ? { id: findGroup(seed, variables).id } : null } }

    case 'FetchPerson': {
      const person = findPerson(seed, variables.id)
      return { data: { person } }
    }

    case 'NotificationsQuery':
      if (variables.resetCount !== false) {
        seed.me.newNotificationCount = 0
      }
      return { data: { notifications: paginate(seed.notifications || [], variables.first, variables.offset) } }

    case 'Search':
      return { data: { search: presentSearch(seed, variables) } }

    default:
      return defaultQuery(rootField, variables, seed, query)
  }
}

/**
 * MapExplorer and similar callers use anonymous `query (...) { group { posts: viewPosts(...) } }`
 * documents. Attach posts whenever the document asks for posts/viewPosts.
 */
function queryRequestsGroupPosts (query = '') {
  return /\b(?:posts|viewPosts)\s*[(:{]/.test(String(query))
}

function hasValidLocationObject (post) {
  const center = post?.locationObject?.center
  if (!center) return false
  const lat = Number(center.lat)
  const lng = Number(center.lng)
  return Number.isFinite(lat) && Number.isFinite(lng)
}

/** Map queries pass boundingBox; drop posts that cannot be plotted. */
function presentPostsForMapOrStream (seed, variables) {
  const posts = presentPostQuerySet(seed, variables)
  if (variables.boundingBox == null) return posts
  const items = (posts.items || []).filter(hasValidLocationObject)
  return {
    ...posts,
    items,
    total: items.length,
    hasMore: false
  }
}

function presentGroupPostsResponse (seed, variables, { requireLocation } = {}) {
  const group = findGroup(seed, variables)
  let posts = presentPostQuerySet(seed, { ...variables, groupId: group?.id, slug: group?.slug })
  if (requireLocation || variables.boundingBox != null) {
    const items = (posts.items || []).filter(hasValidLocationObject)
    posts = {
      ...posts,
      items,
      total: items.length,
      hasMore: false
    }
  }
  return {
    data: {
      group: {
        ...presentGroup(seed, group),
        posts
      }
    }
  }
}

function defaultQuery (rootField, variables, seed, query) {
  switch (rootField) {
    case 'me':
      return { data: { me: presentMe(seed) } }
    case 'group':
      if (queryRequestsGroupPosts(query)) {
        // Map icon + drawer queries are anonymous; only return posts that can plot.
        return presentGroupPostsResponse(seed, variables, { requireLocation: true })
      }
      return { data: { group: presentGroup(seed, findGroup(seed, variables)) } }
    case 'groups':
      return { data: { groups: presentGroupQuerySet(seed, variables) } }
    case 'posts':
      return { data: { posts: presentPostsForMapOrStream(seed, variables) } }
    case 'post':
      return { data: { post: presentPost(seed, findPost(seed, variables.id)) } }
    case 'person':
      return { data: { person: findPerson(seed, variables.id) } }
    case 'people':
      return { data: { people: presentPeopleQuerySet(seed, variables) } }
    case 'messageThread':
      return { data: { messageThread: findThread(seed, variables.id) } }
    case 'search':
      return { data: { search: presentSearch(seed, variables) } }
    case 'notifications':
      return { data: { notifications: paginate(seed.notifications || [], variables.first, variables.offset) } }
    case 'fundingRound':
      return { data: { fundingRound: presentFundingRound(seed, variables.id) } }
    case 'track':
      return { data: { track: presentTrack(seed, variables.id) } }
    // Plain GraphQL lists (not *QuerySet connections) — must be arrays
    case 'siteBanners':
    case 'allSiteBanners':
    case 'platformAgreements':
    case 'emailEnabledTesters':
      return { data: { [rootField]: [] } }
    default:
      return { data: rootField ? { [rootField]: emptyForField(rootField) } : {} }
  }
}

/**
 * Fallback empty value for unhandled root fields.
 * Known plain lists (siteBanners, etc.) are handled in defaultQuery above.
 * Everything else ending in s / Set gets the paginated QuerySet shape.
 */
function emptyForField (rootField) {
  if (rootField.endsWith('s') || rootField.endsWith('Set')) {
    return { items: [], total: 0, hasMore: false }
  }
  return null
}

function handleMutation (operationName, rootField, variables, seed) {
  switch (rootField) {
    case 'createPost':
      return { data: { createPost: createPost(seed, variables) } }
    case 'updatePost':
      return { data: { updatePost: updatePost(seed, variables) } }
    case 'deletePost':
      return { data: { deletePost: deletePost(seed, variables) } }
    case 'createComment':
      return { data: { createComment: createComment(seed, variables) } }
    case 'updateComment':
      return { data: { updateComment: updateComment(seed, variables) } }
    case 'deleteComment':
      return { data: { deleteComment: true } }
    case 'reactOn':
      return { data: { reactOn: { id: sid('reaction', String(Date.now())) } } }
    case 'deleteReaction':
      return { data: { deleteReaction: true } }
    case 'completePost':
      return { data: { completePost: completePost(seed, variables) } }
    case 'enrollInTrack':
      return { data: { enrollInTrack: enrollInTrack(seed, variables) } }
    case 'leaveTrack':
      return { data: { leaveTrack: leaveTrack(seed, variables) } }
    case 'updateMe':
      return { data: { updateMe: updateMe(seed, variables) } }
    case 'createMessage':
      return { data: { createMessage: createMessage(seed, variables) } }
    case 'findOrCreateThread':
      return { data: { findOrCreateThread: findOrCreateThread(seed, variables) } }
    case 'markActivityRead':
      return { data: { markActivityRead: markActivityRead(seed, variables) } }
    case 'markAllActivitiesRead':
      return { data: { markAllActivitiesRead: markAllActivitiesRead(seed) } }
    case 'findOrCreateLocation':
      return {
        data: {
          findOrCreateLocation: {
            id: sid('location', String(Date.now())),
            fullText: variables.data?.fullText || '',
            center: { lat: 37.8044, lng: -122.2712 }
          }
        }
      }
    case 'findOrCreateLinkPreviewByUrl':
      return { data: { findOrCreateLinkPreviewByUrl: null } }
    case 'createInvitation':
      return {
        data: {
          createInvitation: {
            invitations: [],
            error: 'Create an account to invite people'
          }
        }
      }
    case 'createStripeCheckoutSession':
      return {
        data: {
          createStripeCheckoutSession: {
            sessionId: null,
            url: null,
            success: false,
            error: 'Not available in the demo'
          }
        }
      }
    case 'login':
    case 'logout':
    case 'register':
    case 'verifyEmail':
    case 'sendPasswordReset':
    case 'sendEmailVerification':
      return { data: { [rootField]: { error: 'Not available in the demo' } } }
    default: {
      if (!rootField) return { data: {} }
      const payload = variables.data
        ? { id: sid('mut', String(Date.now())), ...variables.data }
        : { success: true, id: variables.id || sid('mut', String(Date.now())), ...variables }
      return { data: { [rootField]: payload } }
    }
  }
}

function presentMe (seed) {
  return seed.me
}

function presentFundingRound (seed, id) {
  if (!id || String(id) !== String(seed.fundingRound.id)) return null
  const fundingSpace = seed.groups.spaces.funding
  return {
    ...seed.fundingRound,
    group: {
      id: fundingSpace.id,
      name: fundingSpace.name,
      slug: fundingSpace.slug,
      homeRoute: fundingSpace.homeRoute,
      memberCount: fundingSpace.memberCount,
      parentGroup: {
        id: seed.groups.main.id,
        slug: seed.groups.main.slug
      }
    }
  }
}

function presentTrack (seed, id) {
  if (!id || String(id) !== String(seed.track.id)) return null
  const trackSpace = seed.groups.spaces.track
  return {
    ...seed.track,
    space: {
      id: trackSpace.id,
      slug: trackSpace.slug,
      type: trackSpace.type,
      homeRoute: trackSpace.homeRoute,
      parentGroup: {
        id: seed.groups.main.id,
        slug: seed.groups.main.slug
      }
    },
    enrolledUsers: {
      items: [{
        id: seed.ids.me,
        name: seed.peopleById[seed.ids.me]?.name,
        avatarUrl: seed.peopleById[seed.ids.me]?.avatarUrl,
        enrolledAt: seed.track.publishedAt,
        completedAt: null
      }],
      total: seed.track.numPeopleEnrolled || 1,
      hasMore: false
    }
  }
}

function presentTrackActionPosts (seed) {
  return (seed.track.actions || []).map(action => presentPost(seed, findPost(seed, action.id) || action))
}

function presentSpaceLinkedGroup (seed, linkedGroup) {
  if (!linkedGroup?.id) return linkedGroup
  const space = seed.groups.all.find(g => String(g.id) === String(linkedGroup.id))
  if (!space) return linkedGroup

  return {
    ...linkedGroup,
    groupViews: { items: presentGroupViews(seed, space) },
    track: String(space.id) === String(seed.groups.spaces.track.id)
      ? presentTrack(seed, seed.track.id)
      : (linkedGroup.track || null),
    fundingRound: String(space.id) === String(seed.groups.spaces.funding.id)
      ? presentFundingRound(seed, seed.fundingRound.id)
      : (linkedGroup.fundingRound || null)
  }
}

function presentGroupView (seed, view) {
  const enriched = view.type === 'space' && view.linkedGroup
    ? { ...view, linkedGroup: presentSpaceLinkedGroup(seed, view.linkedGroup) }
    : { ...view }

  if (enriched.type === 'track-actions') {
    return { ...enriched, collectionPosts: presentTrackActionPosts(seed) }
  }

  if (Array.isArray(enriched.collectionPosts)) {
    return {
      ...enriched,
      collectionPosts: enriched.collectionPosts.map(p => presentPost(seed, findPost(seed, p.id) || p))
    }
  }

  return enriched
}

function presentGroupViews (seed, group) {
  const views = seed.groupViews[group.id] || []
  return views.map(view => presentGroupView(seed, view))
}

function presentGroup (seed, group) {
  if (!group) return null
  const me = seed.peopleById[seed.ids.me]
  const members = membersForGroup(seed, group)
  return {
    ...group,
    canAccess: true,
    memberCount: group.type === 'space' ? members.length : group.memberCount,
    agreements: group.agreements || { items: [] },
    contextWidgets: group.contextWidgets || { items: [] },
    groupViews: { items: presentGroupViews(seed, group) },
    groupRoles: { items: seed.groups.roles.filter(role => !role.groupId || role.groupId === group.id || role.groupId === seed.groups.main.id) },
    stewards: { items: [me] },
    members: paginate(members, 20, 0),
    spaces: {
      items: group.id === seed.groups.main.id
        ? [seed.groups.spaces.chat, seed.groups.spaces.track, seed.groups.spaces.funding]
        : []
    },
    fundingRound: group.id === seed.groups.spaces.funding.id ? presentFundingRound(seed, seed.fundingRound.id) : group.fundingRound || null,
    track: group.id === seed.groups.spaces.track.id ? presentTrack(seed, seed.track.id) : group.track || null
  }
}

function presentGroupQuerySet (seed, variables) {
  let items = seed.groups.all
  if (variables.groupIds?.length) {
    const ids = new Set(variables.groupIds.map(String))
    items = items.filter(g => ids.has(String(g.id)))
  }
  items = items.map(g => presentGroup(seed, g))
  return paginate(items, variables.first, variables.offset)
}

function presentPost (seed, post) {
  if (!post) return null
  const groups = (post.groups || []).map(g => {
    const full = seed.groups.all.find(item => item.id === g.id)
    return full ? { id: full.id, name: full.name, slug: full.slug, avatarUrl: full.avatarUrl } : g
  })
  const comments = post.comments || { items: [], total: post.commentsTotal || 0, hasMore: false }
  const commenters = post.commenters || uniquePresentCommenters(comments.items || [])
  return {
    ...post,
    groups,
    comments,
    commenters,
    commentersTotal: post.commentersTotal || commenters.length,
    commentsTotal: post.commentsTotal || comments.total || 0,
    postReactions: post.postReactions || [],
    myReactions: (post.postReactions || []).filter(r => r.userId === seed.ids.me)
  }
}

function uniquePresentCommenters (items) {
  const seen = new Set()
  const people = []
  for (const comment of items) {
    const person = comment.creator
    if (person?.id && !seen.has(String(person.id))) {
      seen.add(String(person.id))
      people.push({ id: person.id, name: person.name, avatarUrl: person.avatarUrl })
    }
  }
  return people
}

function presentPostQuerySet (seed, variables) {
  let items = listPosts(seed, variables)
  if (variables.types?.length) {
    items = items.filter(p => variables.types.includes(p.type))
  }
  const filterVal = variables.filter
  if (filterVal && filterVal !== 'all' && !filterVal.includes('+')) {
    items = items.filter(p => p.type === filterVal)
  }
  if (variables.search) {
    const q = String(variables.search).toLowerCase()
    items = items.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.details || '').toLowerCase().includes(q)
    )
  }
  if (variables.createdBy?.length) {
    const ids = new Set(variables.createdBy.map(String))
    items = items.filter(p => ids.has(String(p.creator?.id)))
  }
  items = items.map(p => presentPost(seed, p))
  return paginate(items, variables.first, variables.offset)
}

function listPosts (seed, variables) {
  const group = findGroup(seed, variables)
  if (group) {
    if (group.id === seed.groups.main.id) return seed.posts.mainStream
    if (group.id === seed.groups.simple.id) {
      const wantsChat = variables.types?.length === 1 && variables.types[0] === 'chat'
      if (wantsChat) return seed.posts.simpleGroupChat
      return [...(seed.posts.simpleGroupStream || []), ...seed.posts.simpleGroupChat]
    }
    if (group.id === seed.groups.staff.id) {
      const wantsChat = variables.types?.length === 1 && variables.types[0] === 'chat'
      if (wantsChat) return seed.posts.staffGroupChat
      return [...(seed.posts.staffGroupStream || []), ...seed.posts.staffGroupChat]
    }
    if (group.id === seed.groups.spaces.chat.id) return seed.posts.chatSpace
    if (group.id === seed.groups.spaces.funding.id) return seed.posts.fundingSubmissions
    if (group.id === seed.groups.spaces.track.id) {
      const wantsChat = variables.types?.length === 1 && variables.types[0] === 'chat'
      if (wantsChat) return []
      return seed.track.actions
    }
  }
  if (variables.context === 'public') return []
  if (variables.context === 'my') {
    return Object.values(seed.posts.byId).filter(p => p.creator?.id === seed.ids.me)
  }
  return seed.posts.mainStream
}

function presentPeopleQuerySet (seed, variables) {
  let items = [seed.peopleById[seed.ids.me], ...seed.people]
  if (variables.autocomplete) {
    const q = String(variables.autocomplete).toLowerCase()
    items = items.filter(p => (p.name || '').toLowerCase().includes(q))
  }
  return paginate(items, variables.first, variables.offset)
}

/**
 * Local full-text search over seed people, posts, and comments.
 * Mirrors SearchResultQuerySet: items with polymorphic content + __typename.
 */
function presentSearch (seed, variables = {}) {
  const term = String(variables.search || variables.term || '').trim().toLowerCase()
  const typeFilter = variables.type && variables.type !== 'all' ? variables.type : null
  const groupIdSet = variables.groupIds?.length
    ? new Set(variables.groupIds.map(String))
    : null
  const first = variables.first || 10
  const offset = variables.offset || 0

  if (term.length < 2) {
    return { items: [], total: 0, hasMore: false }
  }

  const items = []

  if (!typeFilter || typeFilter === 'person') {
    const people = [seed.peopleById[seed.ids.me], ...seed.people].filter(Boolean)
    for (const person of people) {
      const haystack = [person.name, person.location, person.tagline, person.bio]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(term)) continue
      items.push({
        id: `sr-person-${person.id}`,
        content: {
          __typename: 'Person',
          id: person.id,
          name: person.name,
          location: person.location,
          avatarUrl: person.avatarUrl,
          skills: person.skills || { items: [] }
        }
      })
    }
  }

  if (!typeFilter || typeFilter === 'post') {
    for (const post of Object.values(seed.posts.byId)) {
      if (groupIdSet && !postInGroups(post, groupIdSet)) continue
      const haystack = [post.title, stripHtml(post.details)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(term)) continue
      items.push({
        id: `sr-post-${post.id}`,
        content: {
          __typename: 'Post',
          ...presentPost(seed, post)
        }
      })
    }
  }

  if (!typeFilter || typeFilter === 'comment') {
    for (const post of Object.values(seed.posts.byId)) {
      if (groupIdSet && !postInGroups(post, groupIdSet)) continue
      for (const comment of post.comments?.items || []) {
        const haystack = stripHtml(comment.text || '').toLowerCase()
        if (!haystack.includes(term)) continue
        items.push({
          id: `sr-comment-${comment.id}`,
          content: {
            __typename: 'Comment',
            id: comment.id,
            text: comment.text,
            createdAt: comment.createdAt,
            creator: comment.creator,
            attachments: comment.attachments || [],
            post: {
              __typename: 'Post',
              ...presentPost(seed, post)
            }
          }
        })
      }
    }
  }

  return paginate(items, first, offset)
}

function postInGroups (post, groupIdSet) {
  return (post.groups || []).some(g => groupIdSet.has(String(g.id)))
}

function stripHtml (html = '') {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function membersForGroup (seed, group) {
  if (!group) return []
  const me = seed.peopleById[seed.ids.me]
  if (group.id === seed.groups.simple.id) {
    return [
      me,
      ...seed.people.filter(p => p.starterGroup)
    ]
  }
  if (group.id === seed.groups.staff.id) {
    return [
      me,
      ...seed.people.filter(p => p.staffGroup)
    ]
  }
  const namedTerran = seed.people.filter(p => !p.starterGroup && p.avatarUrl)
  if (group.id === seed.groups.spaces.chat.id) {
    return [me, ...namedTerran]
  }
  if (group.id === seed.groups.spaces.track.id) {
    return [me, ...namedTerran.slice(6, 16)]
  }
  if (group.id === seed.groups.spaces.funding.id) {
    const ids = new Set([
      sid('person', '002'),
      sid('person', '003'),
      sid('person', '005'),
      sid('person', '007'),
      sid('person', '010'),
      sid('person', '012'),
      sid('person', '016')
    ])
    return [me, ...seed.people.filter(p => ids.has(p.id))]
  }
  return [
    me,
    ...seed.people.filter(p => !p.starterGroup)
  ]
}

function findGroup (seed, { id, slug, groupId } = {}) {
  const key = slug || id || groupId
  if (!key) return seed.groups.main
  return seed.groups.all.find(g =>
    String(g.id) === String(key) || g.slug === key
  ) || null
}

function findPost (seed, id) {
  if (!id) return null
  return seed.posts.byId[id] || Object.values(seed.posts.byId).find(p => String(p.id) === String(id)) || null
}

function findPerson (seed, id) {
  if (!id) return seed.peopleById[seed.ids.me]
  return seed.peopleById[id] || seed.people.find(p => String(p.id) === String(id)) || null
}

function findThread (seed, id) {
  return seed.messageThreads.find(t => String(t.id) === String(id)) || null
}

function completePost (seed, variables) {
  const post = findPost(seed, variables.postId)
  if (!post) return null

  const completionResponse = variables.completionResponse
    ? JSON.parse(variables.completionResponse)
    : []
  const completedAt = new Date().toISOString()

  post.completedAt = completedAt
  post.completionResponse = completionResponse

  const action = (seed.track.actions || []).find(item => String(item.id) === String(post.id))
  if (action) {
    action.completedAt = completedAt
    action.completionResponse = completionResponse
  }

  return {
    id: post.id,
    completedAt,
    completionResponse
  }
}

function enrollInTrack (seed, variables) {
  if (String(variables.trackId) !== String(seed.track.id)) return null
  seed.track.isEnrolled = true
  return { id: seed.track.id, isEnrolled: true }
}

function leaveTrack (seed, variables) {
  if (String(variables.trackId) !== String(seed.track.id)) return null
  seed.track.isEnrolled = false
  return { id: seed.track.id, isEnrolled: false }
}

function paginate (items = [], first = 20, offset = 0) {
  const start = offset || 0
  const limit = first || 20
  const slice = items.slice(start, start + limit)
  return {
    items: slice,
    total: items.length,
    hasMore: start + slice.length < items.length
  }
}

function createPost (seed, variables) {
  const groupIds = variables.groupIds || []
  const group = seed.groups.all.find(g => groupIds.includes(g.id)) || seed.groups.main
  const post = {
    id: variables.localId || sid('post', String(Date.now())),
    title: variables.title,
    details: variables.details,
    type: variables.type || 'discussion',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    creator: seed.peopleById[seed.ids.me],
    groups: [{ id: group.id, name: group.name, slug: group.slug }],
    groupsTotal: 1,
    commentsTotal: 0,
    comments: { items: [], total: 0, hasMore: false },
    postReactions: [],
    localId: variables.localId,
    announcement: variables.announcement || false,
    isPublic: variables.isPublic || false
  }
  seed.posts.byId[post.id] = post
  if (group.id === seed.groups.main.id) seed.posts.mainStream.unshift(post)
  else if (group.id === seed.groups.simple.id) {
    if (post.type === 'chat') seed.posts.simpleGroupChat.unshift(post)
    else (seed.posts.simpleGroupStream || (seed.posts.simpleGroupStream = [])).unshift(post)
  } else if (group.id === seed.groups.staff.id) {
    if (post.type === 'chat') seed.posts.staffGroupChat.unshift(post)
    else (seed.posts.staffGroupStream || (seed.posts.staffGroupStream = [])).unshift(post)
  } else if (group.id === seed.groups.spaces.chat.id) seed.posts.chatSpace.unshift(post)
  return presentPost(seed, post)
}

function updatePost (seed, variables) {
  const post = findPost(seed, variables.id || variables.postId)
  if (!post) return null
  Object.assign(post, variables.data || variables)
  post.updatedAt = new Date().toISOString()
  return presentPost(seed, post)
}

function deletePost (seed, variables) {
  const id = variables.id
  delete seed.posts.byId[id]
  const lists = [seed.posts.mainStream, seed.posts.chatSpace, seed.posts.simpleGroupChat, seed.posts.simpleGroupStream, seed.posts.staffGroupChat, seed.posts.staffGroupStream, seed.posts.fundingSubmissions].filter(Boolean)
  for (const list of lists) {
    const idx = list.findIndex(p => String(p.id) === String(id))
    if (idx !== -1) list.splice(idx, 1)
  }
  return true
}

function createComment (seed, variables) {
  const post = findPost(seed, variables.postId)
  const comment = {
    id: sid('comment', String(Date.now())),
    text: variables.text,
    createdAt: new Date().toISOString(),
    creator: seed.peopleById[seed.ids.me],
    childComments: [],
    commentsTotal: 0
  }
  if (post) {
    if (!post.comments) post.comments = { items: [], total: 0, hasMore: false }
    post.comments.items.push(comment)
    post.comments.total += 1
    post.commentsTotal = post.comments.total
  }
  return comment
}

function updateComment (seed, variables) {
  return {
    id: variables.id,
    text: variables.data?.text || variables.text,
    createdAt: new Date().toISOString(),
    creator: seed.peopleById[seed.ids.me]
  }
}

function updateMe (seed, variables) {
  const changes = variables.changes || variables
  Object.assign(seed.me, changes)
  if (changes.settings) {
    seed.me.settings = { ...seed.me.settings, ...changes.settings }
  }
  return presentMe(seed)
}

function createMessage (seed, variables) {
  const data = variables.data || variables
  const thread = findThread(seed, data.messageThreadId)
  const message = {
    id: sid('msg', String(Date.now())),
    text: data.text,
    createdAt: new Date().toISOString(),
    editedAt: null,
    creator: seed.peopleById[seed.ids.me]
  }
  if (thread) {
    thread.messages.items.push(message)
    thread.messages.total += 1
    thread.updatedAt = message.createdAt
  }
  return message
}

function findOrCreateThread (seed, variables) {
  const participantIds = variables.data?.participantIds || variables.participantIds || []
  const existing = seed.messageThreads.find(thread => {
    const ids = (thread.participants || []).map(p => p.id).sort()
    const wanted = [...participantIds, seed.ids.me].filter((v, i, a) => a.indexOf(v) === i).sort()
    return ids.join() === wanted.join()
  })
  if (existing) return existing
  const participants = [seed.peopleById[seed.ids.me], ...participantIds.map(id => seed.peopleById[id]).filter(Boolean)]
  const thread = {
    id: sid('thread', String(Date.now())),
    type: participants.length > 2 ? 'group' : 'direct',
    participants,
    participantsTotal: participants.length,
    unreadCount: 0,
    isMuted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: { items: [], total: 0, hasMore: false }
  }
  seed.messageThreads.unshift(thread)
  return thread
}

function markActivityRead (seed, variables) {
  const activityId = variables.id
  for (const notification of seed.notifications || []) {
    if (String(notification.activity.id) === String(activityId)) {
      notification.activity.unread = false
    }
  }
  seed.me.newNotificationCount = (seed.notifications || []).filter(n => n.activity.unread).length
  return { id: activityId }
}

function markAllActivitiesRead (seed) {
  for (const notification of seed.notifications || []) {
    notification.activity.unread = false
  }
  seed.me.newNotificationCount = 0
  return { success: true }
}
