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

  return handleQuery(operationName, rootField, variables, seed)
}

function handleQuery (operationName, rootField, variables, seed) {
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

    case 'GroupPostsQuery': {
      const group = findGroup(seed, variables)
      return {
        data: {
          group: {
            ...presentGroup(seed, group),
            posts: presentPostQuerySet(seed, { ...variables, groupId: group?.id, slug: group?.slug })
          }
        }
      }
    }

    case 'PostsQuery':
      return { data: { posts: presentPostQuerySet(seed, variables) } }

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

    default:
      return defaultQuery(rootField, variables, seed)
  }
}

function defaultQuery (rootField, variables, seed) {
  switch (rootField) {
    case 'me':
      return { data: { me: presentMe(seed) } }
    case 'group':
      return { data: { group: presentGroup(seed, findGroup(seed, variables)) } }
    case 'groups':
      return { data: { groups: presentGroupQuerySet(seed, variables) } }
    case 'posts':
      return { data: { posts: presentPostQuerySet(seed, variables) } }
    case 'post':
      return { data: { post: presentPost(seed, findPost(seed, variables.id)) } }
    case 'person':
      return { data: { person: findPerson(seed, variables.id) } }
    case 'people':
      return { data: { people: presentPeopleQuerySet(seed, variables) } }
    case 'messageThread':
      return { data: { messageThread: findThread(seed, variables.id) } }
    case 'search':
      return { data: { search: { items: [], total: 0, hasMore: false } } }
    case 'notifications':
      return { data: { notifications: paginate(seed.notifications || [], variables.first, variables.offset) } }
    default:
      return { data: rootField ? { [rootField]: emptyForField(rootField) } : {} }
  }
}

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
            center: { lat: 45.5231, lng: -122.6765 }
          }
        }
      }
    case 'findOrCreateLinkPreviewByUrl':
      return { data: { findOrCreateLinkPreviewByUrl: null } }
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

function presentGroup (seed, group) {
  if (!group) return null
  const me = seed.peopleById[seed.ids.me]
  return {
    ...group,
    canAccess: true,
    agreements: group.agreements || { items: [] },
    contextWidgets: group.contextWidgets || { items: [] },
    groupViews: { items: seed.groupViews[group.id] || [] },
    groupRoles: { items: seed.groups.roles.filter(role => !role.groupId || role.groupId === group.id || role.groupId === seed.groups.main.id) },
    stewards: { items: [me] },
    members: paginate(membersForGroup(seed, group), 20, 0),
    spaces: {
      items: group.id === seed.groups.main.id
        ? [seed.groups.spaces.chat, seed.groups.spaces.track, seed.groups.spaces.funding]
        : []
    },
    fundingRound: group.id === seed.groups.spaces.funding.id ? seed.fundingRound : group.fundingRound || null,
    track: group.id === seed.groups.spaces.track.id ? seed.track : group.track || null
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
    if (group.id === seed.groups.spaces.chat.id) return seed.posts.chatSpace
    if (group.id === seed.groups.spaces.funding.id) return seed.posts.fundingSubmissions
    if (group.id === seed.groups.spaces.track.id) return seed.track.actions
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

function membersForGroup (seed, group) {
  if (!group) return []
  const me = seed.peopleById[seed.ids.me]
  if (group.id === seed.groups.simple.id) {
    return [
      me,
      ...seed.people.filter(p => p.starterGroup)
    ]
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
  }
  else if (group.id === seed.groups.spaces.chat.id) seed.posts.chatSpace.unshift(post)
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
  const lists = [seed.posts.mainStream, seed.posts.chatSpace, seed.posts.simpleGroupChat, seed.posts.simpleGroupStream, seed.posts.fundingSubmissions].filter(Boolean)
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
