import { loadSandboxSeedSync } from './seed'
import { buildEnSeed } from './seed/en'
import { handleGraphql } from './handlers'
import { ME_ID } from './seed/en/people'
import { MAIN_GROUP_ID } from './seed/en/groups'
import { MAIN_GROUP_SLUG } from './seed/constants'

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

  it('has unique ids across seeded posts, people, groups, comments, and threads', () => {
    const postIds = Object.keys(seed.posts.byId)
    expect(postIds.length).toBe(
      seed.posts.mainStream.length +
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

  it('exposes commenters and comments on Terran stream posts', () => {
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
      query: 'query ($id: ID) { fundingRound(id: $id) { id title bannerUrl numSubmissions submissions { items { id title } } } }',
      variables: { id: seed.ids.fundingRound }
    }, seed)

    expect(result.data.fundingRound.title).toBe('Bioregional Grants Round 1')
    expect(result.data.fundingRound.bannerUrl).toContain('BF-Logo_W')
    expect(result.data.fundingRound.numSubmissions).toBe(5)
    expect(result.data.fundingRound.submissions.items.length).toBe(5)
  })

  it('returns orientation steps as collectionPosts on the track space', () => {
    const trackSpace = seed.groups.spaces.track
    const result = handleGraphql({
      query: 'query ($groupId: ID) { group(id: $groupId) { id track { id name } groupViews { items { id type collectionPosts { id title type completionAction } } } } }',
      variables: { groupId: trackSpace.id }
    }, seed)

    expect(result.data.group.track.name).toBe('New Member Orientation')
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
      query: 'query FetchGroupsMenuData { groups(first: 10) { items { id groupViews { items { type linkedGroup { id groupViews { items { type collectionPosts { id title } } } track { id name isEnrolled } } } } } } }'
    }, seed)

    const trackSpaceId = String(seed.groups.spaces.track.id)
    const parent = parentResult.data.groups.items.find(g => g.slug === 'terran-collective')
    const trackSpaceView = parent.groupViews.items.find(view =>
      view.type === 'space' && String(view.linkedGroup?.id) === trackSpaceId
    )

    expect(trackSpaceView.linkedGroup.track.name).toBe('New Member Orientation')
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
})
