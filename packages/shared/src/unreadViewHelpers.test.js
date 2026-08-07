import {
  CHAT_VISIBLE_POST_TYPES,
  postCountsTowardChatUnread,
  recountPostTypesForView,
  POST_TYPE_TO_TYPED_VIEW,
  POST_TYPE_TO_VIEW_TYPE
} from './unreadViewHelpers'

describe('unreadViewHelpers', () => {
  describe('postCountsTowardChatUnread', () => {
    it('includes chat-visible types when notices are on', () => {
      expect(postCountsTowardChatUnread('chat', true)).toBe(true)
      expect(postCountsTowardChatUnread('discussion', true)).toBe(true)
      expect(postCountsTowardChatUnread('action', true)).toBe(false)
    })

    it('only includes chat when notices are off', () => {
      expect(postCountsTowardChatUnread('chat', false)).toBe(true)
      expect(postCountsTowardChatUnread('discussion', false)).toBe(false)
    })
  })

  describe('recountPostTypesForView', () => {
    it('returns chat-visible types for chat with notices on', () => {
      expect(recountPostTypesForView('chat', true)).toEqual(CHAT_VISIBLE_POST_TYPES)
    })

    it('returns only chat for chat with notices off', () => {
      expect(recountPostTypesForView('chat', false)).toEqual(['chat'])
    })

    it('returns typed post types for common views', () => {
      expect(recountPostTypesForView('discussions')).toEqual(['discussion'])
      expect(recountPostTypesForView('requests-and-offers')).toEqual(['offer', 'request'])
    })

    it('returns null for non-badge views', () => {
      expect(recountPostTypesForView('all')).toBe(null)
      expect(recountPostTypesForView('custom')).toBe(null)
    })
  })

  it('aliases POST_TYPE_TO_VIEW_TYPE to POST_TYPE_TO_TYPED_VIEW', () => {
    expect(POST_TYPE_TO_VIEW_TYPE).toBe(POST_TYPE_TO_TYPED_VIEW)
  })
})
