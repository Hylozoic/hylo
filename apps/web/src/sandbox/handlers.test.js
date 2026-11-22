import { iconForView } from '@hylo/presenters/GroupViewPresenter'
import { loadSandboxSeedSync } from './seed'
import { buildEnSeed } from './seed/en'
import { handleGraphql } from './handlers'
import { ME_ID } from './seed/en/people'
import { MAIN_GROUP_ID, MAIN_ADMINISTRATOR_ROLE_ID, MAIN_MODERATOR_ROLE_ID, SIMPLE_GROUP_ID, STAFF_GROUP_ID } from './seed/en/groups'
import { MAIN_GROUP_SLUG, SIMPLE_GROUP_SLUG } from './seed/constants'
import {
  createTask,
  createTaskStatus,
  deleteTaskStatus,
  fetchTaskBoard,
  fetchTaskColumnPage,
  fetchTaskEvents,
  fetchTaskStatuses,
  moveTask,
  stepOffTask,
  takeTask,
  updateTaskStatus
} from 'store/actions/taskActions'

describe('sandbox GraphQL handlers', () => {
  let seed

  beforeEach(() => {
    seed = loadSandboxSeedSync(buildEnSeed)
  })

  it('answers CheckLogin with a fully authorized me', () => {
    const result = handleGraphql({
      query: 'query CheckLogin { me { id emailValidated hasRegistered } }'
    }, seed)

    expect(result.data.me.id).toBe(ME_ID)
    expect(result.data.me.emailValidated).toBe(true)
    expect(result.data.me.hasRegistered).toBe(true)
    expect(result.data.me.settings.signupInProgress).toBe(false)
    expect(result.data.me.memberships.length).toBe(6)
  })

  it('makes me an administrator of the main group only', () => {
    const { me } = handleGraphql({ query: 'query MeQuery { me { id } }' }, seed).data
    const titlesFor = groupId => me.groupRoles.items
      .filter(role => String(role.groupId) === String(groupId))
      .flatMap(role => role.responsibilities.items.map(r => r.title))

    expect(titlesFor(MAIN_GROUP_ID)).toEqual(expect.arrayContaining(['Administration', 'Add Members', 'Remove Members', 'Manage Content']))
    expect(titlesFor(SIMPLE_GROUP_ID)).toEqual([])
    expect(titlesFor(STAFF_GROUP_ID)).toEqual([])
  })

  it('answers responsibilities queries with plain lists', () => {
    const forGroup = handleGraphql({
      query: 'query fetchResponsibiltiesForGroup ($groupId: ID) { responsibilities (groupId: $groupId) { id title type } }',
      variables: { groupId: MAIN_GROUP_ID }
    }, seed).data.responsibilities
    expect(Array.isArray(forGroup)).toBe(true)
    expect(forGroup.map(r => r.title)).toContain('Administration')
    expect(new Set(forGroup.map(r => r.id)).size).toBe(forGroup.length)

    const forRole = handleGraphql({
      query: 'query fetchResponsibilitiesForGroupRole ($groupRoleId: ID) { responsibilities (groupRoleId: $groupRoleId) { id title responsibilityId } }',
      variables: { groupRoleId: MAIN_ADMINISTRATOR_ROLE_ID }
    }, seed).data.responsibilities
    expect(forRole.length).toBe(forGroup.length)
    expect(forRole[0].responsibilityId).toBe(forRole[0].id)
  })

  it('filters group members by role', () => {
    const query = `query fetchMembersForGroupRole ($id: ID, $groupRoleIds: [ID], $first: Int, $offset: Int) {
      group (id: $id) { id members (first: $first, offset: $offset, groupRoleIds: $groupRoleIds) { items { id } } }
    }`
    const admins = handleGraphql({ query, variables: { id: MAIN_GROUP_ID, groupRoleIds: [MAIN_ADMINISTRATOR_ROLE_ID], first: 20, offset: 0 } }, seed)
    expect(admins.data.group.members.items.map(p => p.id)).toEqual([ME_ID])

    const moderators = handleGraphql({ query, variables: { id: MAIN_GROUP_ID, groupRoleIds: [MAIN_MODERATOR_ROLE_ID], first: 20, offset: 0 } }, seed)
    expect(moderators.data.group.members.items).toEqual([])

    const details = handleGraphql({
      query: `query fetchGroupRoleDetails ($id: ID, $groupRoleIds: [ID], $groupRoleId: ID, $first: Int, $offset: Int) {
        group (id: $id) { id members (first: $first, offset: $offset, groupRoleIds: $groupRoleIds) { items { id } } }
        responsibilities (groupRoleId: $groupRoleId) { id title responsibilityId }
      }`,
      variables: { id: MAIN_GROUP_ID, groupRoleIds: [MAIN_ADMINISTRATOR_ROLE_ID], groupRoleId: MAIN_ADMINISTRATOR_ROLE_ID, first: 20, offset: 0 }
    }, seed)
    expect(details.data.group.members.items.map(p => p.id)).toEqual([ME_ID])
    expect(details.data.responsibilities.map(r => r.title)).toContain('Administration')

    const counts = handleGraphql({
      query: `query FetchRoleMemberCounts ($slug: String) {
        group (slug: $slug) {
          id
          r${MAIN_ADMINISTRATOR_ROLE_ID}: members (first: 1, groupRoleIds: ["${MAIN_ADMINISTRATOR_ROLE_ID}"]) { total }
          r${MAIN_MODERATOR_ROLE_ID}: members (first: 1, groupRoleIds: ["${MAIN_MODERATOR_ROLE_ID}"]) { total }
        }
      }`,
      variables: { slug: MAIN_GROUP_SLUG }
    }, seed)
    expect(counts.data.group[`r${MAIN_ADMINISTRATOR_ROLE_ID}`].total).toBe(1)
    expect(counts.data.group[`r${MAIN_MODERATOR_ROLE_ID}`].total).toBe(0)
  })

  it('merges user setting changes without dropping other settings', () => {
    const before = seed.me.settings
    const result = handleGraphql({
      query: 'mutation ($changes: MeInput) { updateMe(changes: $changes) { id settings { theme colorScheme } } }',
      variables: { changes: { settings: { theme: 'forest' } } }
    }, seed)

    expect(result.data.updateMe.settings.theme).toBe('forest')
    expect(result.data.updateMe.settings.colorScheme).toBe(before.colorScheme)
    expect(result.data.updateMe.settings.groupNavStyle).toBe(before.groupNavStyle)
  })

  it('returns group stream posts for GroupPostsQuery', () => {
    const result = handleGraphql({
      query: 'query GroupPostsQuery ($slug: String) { group(slug: $slug) { id posts { items { id } } } }',
      variables: { slug: MAIN_GROUP_SLUG }
    }, seed)

    expect(result.data.group.slug).toBe(MAIN_GROUP_SLUG)
    expect(result.data.group.posts.items.length).toBeGreaterThan(0)
    expect(result.data.group.canAccess).toBe(true)
    expect(/^\d+$/.test(result.data.group.posts.items[0].id)).toBe(true)
  })

  it('pages Local Sharing Network chat by id so a return visit does not repeat the room', () => {
    const query = `query GroupPostsQuery ($slug: String, $cursor: ID, $order: String, $sortBy: String, $filter: String, $types: [String], $first: Int) {
      group(slug: $slug) { posts(cursor: $cursor, order: $order, sortBy: $sortBy, filter: $filter, types: $types, first: $first) { hasMore items { id } } }
    }`
    const base = { slug: SIMPLE_GROUP_SLUG, sortBy: 'id', filter: 'chat', types: ['chat'], first: 25 }

    const past = handleGraphql({ query, variables: { ...base, order: 'desc' } }, seed)
    const pastIds = past.data.group.posts.items.map(post => post.id)
    expect(pastIds).toEqual([...seed.posts.simpleGroupChat].map(post => post.id).sort((a, b) => Number(b) - Number(a)))
    expect(new Set(pastIds).size).toBe(pastIds.length)

    const newestId = pastIds[0]
    const newer = handleGraphql({
      query,
      variables: { ...base, order: 'asc', cursor: newestId }
    }, seed)
    expect(newer.data.group.posts.items).toEqual([])
    expect(newer.data.group.posts.hasMore).toBe(false)

    const older = handleGraphql({
      query,
      variables: { ...base, order: 'desc', cursor: pastIds[pastIds.length - 1] }
    }, seed)
    expect(older.data.group.posts.items).toEqual([])

    const middle = pastIds[Math.floor(pastIds.length / 2)]
    const before = handleGraphql({
      query,
      variables: { ...base, order: 'desc', cursor: String(Number(middle) + 1) }
    }, seed).data.group.posts.items.map(post => post.id)
    const after = handleGraphql({
      query,
      variables: { ...base, order: 'asc', cursor: middle }
    }, seed).data.group.posts.items.map(post => post.id)
    expect(before.filter(id => after.includes(id))).toEqual([])
    expect(before.length + after.length).toBe(pastIds.length)
  })

  it('returns only located posts for anonymous MapExplorer group/viewPosts queries', () => {
    const result = handleGraphql({
      query: `query (
        $boundingBox: [PointInput],
        $first: Int,
        $slug: String
      ) {
        group(slug: $slug, updateLastViewed: true) {
          id
          slug
          posts: viewPosts(boundingBox: $boundingBox, first: $first) {
            hasMore
            total
            items { id title type locationObject { id center { lat lng } } }
          }
        }
      }`,
      variables: { slug: MAIN_GROUP_SLUG, first: 500 }
    }, seed)

    expect(result.data.group.slug).toBe(MAIN_GROUP_SLUG)
    expect(result.data.group.posts.items.length).toBeGreaterThan(0)
    expect(result.data.group.posts.items.every(post => {
      const { lat, lng } = post.locationObject?.center || {}
      return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    })).toBe(true)
    expect(result.data.group.posts.items.length).toBeLessThan(seed.posts.mainStream.length)
  })

  it('does not attach posts to anonymous group queries that only ask for group fields', () => {
    const result = handleGraphql({
      query: 'query ($slug: String) { group(slug: $slug) { id slug name } }',
      variables: { slug: MAIN_GROUP_SLUG }
    }, seed)

    expect(result.data.group.slug).toBe(MAIN_GROUP_SLUG)
    expect(result.data.group.posts).toBeUndefined()
  })

  it('creates a post that then appears in the stream', () => {
    const created = handleGraphql({
      query: 'mutation CreatePost { createPost(data: {}) { id title } }',
      variables: { title: 'Hello sandbox', details: '<p>hi</p>', type: 'discussion', groupIds: [MAIN_GROUP_ID] }
    }, seed)

    expect(created.data.createPost.title).toBe('Hello sandbox')

    const listed = handleGraphql({
      query: 'query GroupPostsQuery ($slug: String) { group(slug: $slug) { posts { items { id title } } } }',
      variables: { slug: MAIN_GROUP_SLUG }
    }, seed)

    expect(listed.data.group.posts.items[0].id).toBe(created.data.createPost.id)
  })

  it('gives Community Hub a chat view and an Introductions space', () => {
    const names = seed.groupViews[MAIN_GROUP_ID].map(view => view.name)
    expect(names).toEqual(expect.arrayContaining(['Chat', 'Introductions']))
    expect(seed.groups.spaces.chat.slug).toBe('introductions')

    const chat = handleGraphql({
      query: 'query GroupPostsQuery ($slug: String, $filter: String, $sortBy: String, $order: String) { group(slug: $slug) { posts(filter: $filter, sortBy: $sortBy, order: $order) { items { details } } } }',
      variables: { slug: MAIN_GROUP_SLUG, filter: 'chat', sortBy: 'id', order: 'desc' }
    }, seed)
    expect(chat.data.group.posts.items.some(post => post.details.includes('Good morning'))).toBe(true)

    const intros = handleGraphql({
      query: 'query GroupPostsQuery ($slug: String) { group(slug: $slug) { name posts { items { details } } } }',
      variables: { slug: 'introductions' }
    }, seed)
    expect(intros.data.group.name).toBe('Introductions')
    expect(intros.data.group.posts.items.some(post => post.details.includes('I&#39;m Kai'))).toBe(true)
  })

  it('has unique ids across seeded posts, people, groups, comments, and threads', () => {
    const postIds = Object.keys(seed.posts.byId)
    expect(postIds.length).toBe(
      seed.posts.mainStream.length +
      seed.posts.hubChat.length +
      seed.posts.chatSpace.length +
      seed.posts.simpleGroupChat.length +
      (seed.posts.simpleGroupStream || []).length +
      (seed.posts.staffGroupChat || []).length +
      (seed.posts.staffGroupStream || []).length +
      seed.posts.fundingSubmissions.length +
      seed.track.actions.length
    )
    expect(postIds.length).toBe(new Set(postIds).size)

    const streamIds = seed.posts.mainStream.map(p => String(p.id))
    const chatIds = seed.posts.chatSpace.map(p => String(p.id))
    const simpleIds = seed.posts.simpleGroupChat.map(p => String(p.id))
    const fundingIds = seed.posts.fundingSubmissions.map(p => String(p.id))
    const overlap = (a, b) => a.filter(id => b.includes(id))
    expect(overlap(streamIds, chatIds)).toEqual([])
    expect(overlap(streamIds, simpleIds)).toEqual([])
    expect(overlap(streamIds, fundingIds)).toEqual([])
    expect(overlap(chatIds, simpleIds)).toEqual([])

    const peopleIds = [seed.ids.me, ...seed.people.map(p => String(p.id))]
    expect(peopleIds.length).toBe(new Set(peopleIds).size)

    const groupIds = seed.groups.all.map(g => String(g.id))
    expect(groupIds.length).toBe(new Set(groupIds).size)

    const commentIds = Object.values(seed.posts.byId).flatMap(p =>
      (p.comments?.items || []).map(c => String(c.id))
    )
    expect(commentIds.length).toBe(new Set(commentIds).size)

    const threadIds = seed.messageThreads.map(t => String(t.id))
    expect(threadIds.length).toBe(new Set(threadIds).size)

    const messageIds = seed.messageThreads.flatMap(t =>
      (t.messages?.items || []).map(m => String(m.id))
    )
    expect(messageIds.length).toBe(new Set(messageIds).size)
  })

  it('exposes commenters and comments on Community Hub stream posts', () => {
    const withComments = seed.posts.mainStream.filter(p => (p.comments?.items || []).length > 0)
    expect(withComments.length).toBeGreaterThan(0)
    expect(withComments[0].commenters.length).toBeGreaterThan(0)
    expect(withComments[0].comments.items[0].parentComment).toBe(null)

    const listed = handleGraphql({
      query: 'query GroupPostsQuery ($slug: String) { group(slug: $slug) { posts { items { id commentersTotal comments { items { id } } } } } }',
      variables: { slug: MAIN_GROUP_SLUG }
    }, seed)

    const streamPost = listed.data.group.posts.items.find(p => p.comments?.items?.length > 0)
    expect(streamPost.commentersTotal).toBeGreaterThan(0)
  })

  it('returns the bioregional grants funding round with submissions', () => {
    const result = handleGraphql({
      query: 'query ($id: ID) { fundingRound(id: $id) { id group { name bannerUrl } numSubmissions submissions { items { id title } } } }',
      variables: { id: seed.ids.fundingRound }
    }, seed)

    expect(result.data.fundingRound.group.name).toBe('Bioregional Grants Round 1')
    expect(result.data.fundingRound.group.bannerUrl).toContain('BF-Logo_W')
    expect(result.data.fundingRound.numSubmissions).toBe(5)
    expect(result.data.fundingRound.submissions.items.length).toBe(5)
  })

  it('resolves chat and requests views to icons the menu can draw', () => {
    const views = [
      seed.groups.spaces.chat.id,
      seed.groups.spaces.track.id,
      seed.groups.simple.id,
      seed.groups.staff.id
    ].flatMap(groupId => seed.groupViews[groupId] || [])

    const chat = views.filter(view => view.type === 'chat')
    const requests = views.filter(view => view.type === 'requests-and-offers')

    expect(chat.length).toBeGreaterThan(0)
    expect(requests.length).toBeGreaterThan(0)
    chat.forEach(view => {
      expect(iconForView(view)).toEqual({ iconName: null, lucideIcon: 'MessageCircleMore' })
    })
    requests.forEach(view => {
      expect(iconForView(view)).toEqual({ iconName: null, lucideIcon: 'Heart' })
    })
  })

  it('centers Local Sharing Network on North Berkeley with a map, events, and nearby asks', () => {
    const views = seed.groupViews[SIMPLE_GROUP_ID].map(view => view.type)
    expect(views).toEqual(['chat', 'all', 'map', 'events', 'requests-and-offers', 'tasks', 'members'])
    expect(seed.groups.simple.location).toBe('North Berkeley, California, United States')
    expect(seed.groups.simple.locationObject.center).toEqual({ lat: 37.8801, lng: -122.2693 })

    const stream = seed.posts.simpleGroupStream
    const nearGroup = post => {
      const center = post.locationObject?.center
      if (!center) return false
      return Math.abs(center.lat - 37.8801) < 0.02 && Math.abs(center.lng - -122.2693) < 0.03
    }
    expect(stream.filter(post => post.type === 'event' && nearGroup(post)).length).toBe(4)
    expect(stream.filter(post => (post.type === 'request' || post.type === 'offer') && nearGroup(post)).length).toBeGreaterThanOrEqual(8)

    const upcoming = handleGraphql({
      query: 'query ($slug: String, $types: [String], $afterTime: Date, $sortBy: String, $order: String) { group(slug: $slug) { posts(types: $types, afterTime: $afterTime, sortBy: $sortBy, order: $order) { items { title startTime locationObject { center { lat lng } } } } } }',
      variables: {
        slug: SIMPLE_GROUP_SLUG,
        types: ['event'],
        afterTime: new Date().toISOString(),
        sortBy: 'start_time',
        order: 'asc'
      }
    }, seed)

    expect(upcoming.data.group.posts.items.map(post => post.title)).toEqual([
      'North Shattuck produce swap',
      'Tool library open hours',
      'Cedar-Rose neighbourhood potluck'
    ])
    upcoming.data.group.posts.items.forEach(post => {
      expect(post.locationObject.center.lat).toBeGreaterThan(37.86)
    })
  })

  it('returns orientation steps as collectionPosts on the track space', () => {
    const trackSpace = seed.groups.spaces.track
    const result = handleGraphql({
      query: 'query ($groupId: ID) { group(id: $groupId) { id track { id space { name } } groupViews { items { id type collectionPosts { id title type completionAction } } } } }',
      variables: { groupId: trackSpace.id }
    }, seed)

    expect(result.data.group.track.space.name).toBe('New Member Orientation')
    const actionsView = result.data.group.groupViews.items.find(view => view.type === 'track-actions')
    expect(actionsView.collectionPosts.length).toBe(5)
    expect(actionsView.collectionPosts[0].title).toBe('Introduce yourself')
    expect(actionsView.collectionPosts[0].type).toBe('action')
    expect(actionsView.collectionPosts.map(post => post.completionAction)).toEqual([
      'comment',
      'reaction',
      'selectOne',
      'selectMultiple',
      'button'
    ])
  })

  it('keeps track orientation steps when parent menu data is refetched', () => {
    const parentResult = handleGraphql({
      query: 'query FetchGroupsMenuData { groups(first: 10) { items { id groupViews { items { type linkedGroup { id groupViews { items { type collectionPosts { id title } } } track { id space { name } isEnrolled } } } } } } }'
    }, seed)

    const trackSpaceId = String(seed.groups.spaces.track.id)
    const parent = parentResult.data.groups.items.find(g => g.slug === MAIN_GROUP_SLUG)
    const trackSpaceView = parent.groupViews.items.find(view =>
      view.type === 'space' && String(view.linkedGroup?.id) === trackSpaceId
    )

    expect(trackSpaceView.linkedGroup.track.space.name).toBe('New Member Orientation')
    expect(trackSpaceView.linkedGroup.track.isEnrolled).toBe(true)
    const actionsView = trackSpaceView.linkedGroup.groupViews.items.find(view => view.type === 'track-actions')
    expect(actionsView.collectionPosts.length).toBe(5)
  })

  it('persists track step completion in the sandbox seed', () => {
    const actionId = seed.track.actions[0].id
    const result = handleGraphql({
      query: 'mutation CompletePost ($postId: ID, $completionResponse: JSON) { completePost(postId: $postId, completionResponse: $completionResponse) { id completedAt } }',
      variables: { postId: actionId, completionResponse: JSON.stringify(['done']) }
    }, seed)

    expect(result.data.completePost.completedAt).toBeTruthy()
    expect(seed.posts.byId[actionId].completedAt).toBeTruthy()
    expect(seed.track.actions[0].completedAt).toBeTruthy()
  })

  it('gives me full invite access in the groups it presents', () => {
    const result = handleGraphql({
      query: 'query FetchForGroup ($slug: String) { group(slug: $slug) { id myInviteAccess } }',
      variables: { slug: MAIN_GROUP_SLUG }
    }, seed)

    expect(result.data.group.myInviteAccess).toBe('full')
  })

  it('returns siteBanners as a plain array, not a QuerySet', () => {
    const result = handleGraphql({
      query: 'query { siteBanners { id title text type } }'
    }, seed)

    expect(Array.isArray(result.data.siteBanners)).toBe(true)
    expect(result.data.siteBanners).toEqual([])
  })

  it('updates toursSeen on me via updateMe', () => {
    const result = handleGraphql({
      query: 'mutation ($changes: MeInput) { updateMe(changes: $changes) { id settings { toursSeen } } }',
      variables: { changes: { settings: { toursSeen: ['global-chrome', 'group-home'] } } }
    }, seed)

    expect(result.data.updateMe.settings.toursSeen).toEqual(['global-chrome', 'group-home'])
    expect(seed.me.settings.toursSeen).toEqual(['global-chrome', 'group-home'])
  })

  it('returns local search hits for people, posts, and comments', () => {
    const result = handleGraphql({
      query: `query Search ($search: String, $type: String) {
        search(term: $search, first: 20, type: $type) {
          total
          hasMore
          items {
            id
            content {
              __typename
              ... on Person { id name }
              ... on Post { id title }
              ... on Comment { id text }
            }
          }
        }
      }`,
      variables: { search: 'forest' }
    }, seed)

    expect(result.data.search.total).toBeGreaterThan(0)
    const types = new Set(result.data.search.items.map(item => item.content.__typename))
    expect(types.has('Post') || types.has('Comment')).toBe(true)

    const peopleOnly = handleGraphql({
      query: `query Search ($search: String, $type: String) {
        search(term: $search, first: 20, type: $type) {
          items { content { __typename ... on Person { id name } } }
        }
      }`,
      variables: { search: 'Elena', type: 'person' }
    }, seed)
    expect(peopleOnly.data.search.items.length).toBeGreaterThan(0)
    expect(peopleOnly.data.search.items.every(i => i.content.__typename === 'Person')).toBe(true)
  })

  describe('tasks', () => {
    // Run one of the app's own task actions against the sandbox
    const run = action => handleGraphql(action.graphql, seed)
    const board = (groupId = SIMPLE_GROUP_ID, assigneeId) => run(fetchTaskBoard(groupId, assigneeId)).data.group.taskStatuses
    const titles = column => column.tasks.map(task => task.title)

    it('seeds no project posts or projects views', () => {
      expect(Object.values(seed.posts.byId).filter(post => post.type === 'project')).toEqual([])
      expect(Object.values(seed.groupViews).flat().filter(view => view.type === 'projects')).toEqual([])
      expect(seed.groups.all.filter(group => (group.acceptedPostTypes || []).includes('project'))).toEqual([])
      expect(seed.posts.fundingSubmissions.every(post => post.type === 'submission')).toBe(true)
    })

    it('loads the board with the default columns and the seeded tasks', () => {
      const columns = board()
      expect(columns.map(c => [c.name, c.category, c.order])).toEqual([
        ['To do', 'todo', 0],
        ['In progress', 'active', 1],
        ['Ready for review', 'active', 2],
        ['Complete', 'done', 3]
      ])
      expect(titles(columns[0])).toEqual(['Oakland Twilight Markets', 'Side by Side', 'Confirm the gazebo and trestle tables for the market stall'])
      expect(titles(columns[1])).toEqual(['Front Fence Free Food Share', 'Print flyers for the Twilight Markets'])
      expect(columns.map(c => c.tasksTotal)).toEqual([3, 2, 2, 1])
      expect(columns[3].tasks[0].fulfilledAt).toBeTruthy()
      expect(columns[1].tasks[0].members.items.length).toBe(1)

      const seededTasks = Object.values(seed.posts.byId).filter(post => post.type === 'task')
      expect(columns.flatMap(c => c.tasks).length).toBe(seededTasks.length)
    })

    it('gives every seeded task the status of the column it is in', () => {
      const statuses = run(fetchTaskStatuses(SIMPLE_GROUP_ID)).data.group.taskStatuses
      for (const post of Object.values(seed.posts.byId).filter(p => p.type === 'task')) {
        const [placement] = post.taskPlacements
        const status = statuses.find(s => s.id === placement.taskStatusId)
        expect(status).toBeTruthy()
        expect(placement.groupId).toBe(SIMPLE_GROUP_ID)
        expect(placement.statusName).toBe(status.name)
        expect(placement.statusCategory).toBe(status.category)
        expect(post.taskCategory).toBe(status.category)
      }
    })

    it('pages one column for "Load more"', () => {
      const [todo] = board()
      const page = run(fetchTaskColumnPage({ groupId: SIMPLE_GROUP_ID, taskStatusId: todo.id, offset: 1 })).data.group.taskStatus
      expect(page.tasksTotal).toBe(3)
      expect(titles(page)).toEqual(titles(todo).slice(1))
      expect(run(fetchTaskColumnPage({ groupId: SIMPLE_GROUP_ID, taskStatusId: 'nope', offset: 0 })).data.group.taskStatus).toBe(null)
    })

    it('shows only my tasks when asked for one assignee', () => {
      const mine = board(SIMPLE_GROUP_ID, ME_ID)
      expect(mine.flatMap(titles)).toEqual(['Print flyers for the Twilight Markets'])
      expect(mine.map(c => c.tasksTotal)).toEqual([0, 1, 0, 0])
    })

    it('gives a group without seeded tasks an empty board with the default columns', () => {
      const columns = board(MAIN_GROUP_ID)
      expect(columns.map(c => c.name)).toEqual(['To do', 'In progress', 'Ready for review', 'Complete'])
      expect(columns.flatMap(c => c.tasks)).toEqual([])
      const ids = [...columns, ...board()].map(c => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('moves a task to another column and keeps it there', () => {
      const [todo, , review] = board()
      const task = todo.tasks[0]
      const moved = run(moveTask({ postId: task.id, groupId: SIMPLE_GROUP_ID, taskStatusId: review.id, index: 1 })).data.moveTask

      expect(moved.taskCategory).toBe('active')
      expect(moved.taskPlacements[0]).toMatchObject({ taskStatusId: review.id, statusName: 'Ready for review', statusCategory: 'active' })

      const after = board()
      expect(titles(after[0])).not.toContain(task.title)
      expect(titles(after[2])[1]).toBe(task.title)
      expect(after[2].tasksTotal).toBe(3)

      // The opened post and the stream show the new status too
      const opened = handleGraphql({ query: 'query FetchPost ($id: ID) { post(id: $id) { id } }', variables: { id: task.id } }, seed).data.post
      expect(opened.taskPlacements[0].statusName).toBe('Ready for review')
      const inStream = seed.posts.simpleGroupStream.find(post => post.id === task.id)
      expect(inStream.taskPlacements[0].statusName).toBe('Ready for review')
    })

    it('reorders within a column and puts a task with no index at the bottom', () => {
      const [todo, active] = board()
      run(moveTask({ postId: todo.tasks[2].id, groupId: SIMPLE_GROUP_ID, taskStatusId: todo.id, index: 0 }))
      expect(titles(board()[0])).toEqual([todo.tasks[2].title, todo.tasks[0].title, todo.tasks[1].title])

      run(moveTask({ postId: todo.tasks[0].id, groupId: SIMPLE_GROUP_ID, taskStatusId: active.id }))
      expect(titles(board()[1]).pop()).toBe(todo.tasks[0].title)
    })

    it('completes a task moved to a done column and reopens it when moved back', () => {
      const [todo, , , done] = board()
      const task = todo.tasks[0]
      const completed = run(moveTask({ postId: task.id, groupId: SIMPLE_GROUP_ID, taskStatusId: done.id, index: 0 })).data.moveTask
      expect(completed.taskCategory).toBe('done')
      expect(completed.fulfilledAt).toBeTruthy()

      const events = run(fetchTaskEvents(SIMPLE_GROUP_ID)).data.group.taskEvents
      expect(events.map(e => e.type)).toEqual(['completed', 'moved'])
      expect(events[1]).toMatchObject({ meta: { toStatusName: 'Complete', toCategory: 'done' }, actor: { id: ME_ID }, post: { id: task.id } })

      const reopened = run(moveTask({ postId: task.id, groupId: SIMPLE_GROUP_ID, taskStatusId: todo.id })).data.moveTask
      expect(reopened.taskCategory).toBe('todo')
      expect(reopened.fulfilledAt).toBeNull()
    })

    it('refuses to move a post that is not a task', () => {
      const [todo] = board()
      const notATask = seed.posts.simpleGroupStream.find(post => post.type !== 'task')
      expect(() => run(moveTask({ postId: notATask.id, groupId: SIMPLE_GROUP_ID, taskStatusId: todo.id }))).toThrow('Task not found')
    })

    it('adds a task to the bottom of a column', () => {
      const [, active] = board()
      const created = run(createTask({ groupId: SIMPLE_GROUP_ID, title: 'Book the hall', taskStatusId: active.id })).data.createPost
      expect(created).toMatchObject({ title: 'Book the hall', taskCategory: 'active', members: { items: [] } })

      const after = board()[1]
      expect(titles(after).pop()).toBe('Book the hall')
      expect(after.tasksTotal).toBe(3)
      expect(seed.posts.byId[created.id].taskPlacements[0]).toMatchObject({ groupId: SIMPLE_GROUP_ID, taskStatusId: active.id, statusName: 'In progress' })
      expect(seed.posts.simpleGroupStream[0].id).toBe(created.id)
    })

    it('puts a task created without a column in the first column', () => {
      const created = handleGraphql({
        query: 'mutation CreatePost { createPost(data: {}) { id } }',
        variables: { title: 'From the post editor', type: 'task', groupIds: [SIMPLE_GROUP_ID], memberIds: [ME_ID] }
      }, seed).data.createPost
      expect(created.taskPlacements[0].statusName).toBe('To do')
      expect(created.members.items.map(person => person.id)).toEqual([ME_ID])
      expect(titles(board()[0]).pop()).toBe('From the post editor')
    })

    it('takes a task and steps off it', () => {
      const task = board()[0].tasks[0]
      run(takeTask(task.id))
      expect(titles(board(SIMPLE_GROUP_ID, ME_ID)[0])).toEqual([task.title])
      run(stepOffTask(task.id))
      expect(board(SIMPLE_GROUP_ID, ME_ID)[0].tasks).toEqual([])
    })

    it('adds, renames, recategorises and reorders columns', () => {
      const added = run(createTaskStatus({ groupId: SIMPLE_GROUP_ID, name: 'Blocked' })).data.createTaskStatus
      expect(added).toMatchObject({ name: 'Blocked', category: 'active', order: 4 })

      const [todo] = board()
      run(updateTaskStatus({ id: todo.id, name: 'Backlog', category: 'active' }))
      const renamed = seed.posts.byId[todo.tasks[0].id]
      expect(renamed.taskPlacements[0]).toMatchObject({ statusName: 'Backlog', statusCategory: 'active' })
      expect(renamed.taskCategory).toBe('active')

      run(updateTaskStatus({ id: added.id, order: 0 }))
      expect(board().map(c => [c.name, c.order])).toEqual([
        ['Blocked', 0], ['Backlog', 1], ['In progress', 2], ['Ready for review', 3], ['Complete', 4]
      ])
    })

    it('moves a deleted column\'s tasks to the first column', () => {
      const [todo, active] = board()
      expect(run(deleteTaskStatus(active.id)).data.deleteTaskStatus).toEqual({ success: true })

      const after = board()
      expect(after.map(c => c.name)).toEqual(['To do', 'Ready for review', 'Complete'])
      expect(after.map(c => c.order)).toEqual([0, 1, 2])
      expect(titles(after[0])).toEqual([...titles(todo), ...titles(active)])
    })

    it('keeps the board\'s only done column', () => {
      const done = board()[3]
      expect(() => run(deleteTaskStatus(done.id))).toThrow()
      expect(() => run(updateTaskStatus({ id: done.id, category: 'active' }))).toThrow()
      expect(board().length).toBe(4)
    })
  })
})
