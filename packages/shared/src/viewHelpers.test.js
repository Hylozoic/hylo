import {
  CHAT_VISIBLE_POST_TYPES,
  MAX_PINNED_POSTS_PER_VIEW,
  PINNABLE_VIEW_TYPES,
  membershipBadgeCountFromViews,
  postAppearsInChat,
  postCountsTowardChatUnread,
  recountPostTypesForView,
  POST_TYPE_TO_TYPED_VIEW,
  POST_TYPE_TO_VIEW_TYPE
} from './viewHelpers'

describe('viewHelpers', () => {
  describe('postAppearsInChat', () => {
    it('includes chat-visible types when notices are on', () => {
      expect(postAppearsInChat('chat', true)).toBe(true)
      expect(postAppearsInChat('discussion', true)).toBe(true)
      expect(postAppearsInChat('action', true)).toBe(false)
    })

    it('only includes chat when notices are off', () => {
      expect(postAppearsInChat('chat', false)).toBe(true)
      expect(postAppearsInChat('discussion', false)).toBe(false)
    })
  })

  describe('postCountsTowardChatUnread', () => {
    it('is true only for chat posts', () => {
      expect(postCountsTowardChatUnread('chat')).toBe(true)
      expect(postCountsTowardChatUnread('discussion')).toBe(false)
      expect(postCountsTowardChatUnread('action')).toBe(false)
    })
  })

  describe('recountPostTypesForView', () => {
    it('returns only chat for the chat view', () => {
      expect(recountPostTypesForView('chat')).toEqual(['chat'])
      expect(recountPostTypesForView('chat')).not.toEqual(CHAT_VISIBLE_POST_TYPES)
    })

    it('returns typed post types for common views', () => {
      expect(recountPostTypesForView('discussions')).toEqual(['discussion'])
      expect(recountPostTypesForView('requests-and-offers')).toEqual(['offer', 'request'])
    })

    it('returns null for non-badge views', () => {
      expect(recountPostTypesForView('all')).toBe(null)
      expect(recountPostTypesForView('custom')).toBe(null)
      expect(recountPostTypesForView('space-collection')).toBe(null)
    })
  })

  describe('membershipBadgeCountFromViews', () => {
    it('adds chat unread plus one per other on-menu typed view', () => {
      expect(membershipBadgeCountFromViews([
        { type: 'chat', order: 0, newPostCount: 7 },
        { type: 'discussions', order: 1, newPostCount: 4 },
        { type: 'events', order: 2, newPostCount: 1 },
        { type: 'all', order: 3, newPostCount: 9 }
      ])).toBe(9)
    })

    it('omits hidden typed views and counts no badge as 0', () => {
      expect(membershipBadgeCountFromViews([
        { type: 'chat', order: 0, newPostCount: 0 },
        { type: 'discussions', order: null, newPostCount: 3 }
      ])).toBe(0)
    })
  })

  it('aliases POST_TYPE_TO_VIEW_TYPE to POST_TYPE_TO_TYPED_VIEW', () => {
    expect(POST_TYPE_TO_VIEW_TYPE).toBe(POST_TYPE_TO_TYPED_VIEW)
  })

  it('lists pinnable view types and a max of 3 pins', () => {
    expect(PINNABLE_VIEW_TYPES).toEqual(expect.arrayContaining([
      'all', 'discussions', 'chat', 'custom', 'collection'
    ]))
    expect(MAX_PINNED_POSTS_PER_VIEW).toBe(3)
  })
})
