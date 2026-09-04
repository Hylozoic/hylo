import {
  viewShowsUnreadBadge,
  viewUnreadBadgeCount,
  viewShowsUnreadDot,
  groupMenuHasUnreadBadges
} from './viewUnreadBadges'
import { singleVisibleMenuView } from 'store/models/GroupView'

describe('viewUnreadBadges', () => {
  it('shows numbered badge for chat only', () => {
    expect(viewUnreadBadgeCount({ type: 'chat', newPostCount: 3 })).toBe(3)
    expect(viewUnreadBadgeCount({ type: 'discussions', newPostCount: 3 })).toBe(null)
  })

  it('uses the lone space view for the space-row badge', () => {
    const loneChat = singleVisibleMenuView([
      { type: 'chat', order: 0, newPostCount: 7 },
      { type: 'events', order: null, newPostCount: 2 }
    ])
    expect(viewUnreadBadgeCount(loneChat)).toBe(7)
    expect(viewShowsUnreadDot(loneChat)).toBe(false)

    const loneDiscussions = singleVisibleMenuView([
      { type: 'discussions', order: 0, newPostCount: 1 }
    ])
    expect(viewUnreadBadgeCount(loneDiscussions)).toBe(null)
    expect(viewShowsUnreadDot(loneDiscussions)).toBe(true)
  })

  it('shows dot for typed common views', () => {
    expect(viewShowsUnreadDot({ type: 'discussions', newPostCount: 1 })).toBe(true)
    expect(viewShowsUnreadDot({ type: 'chat', newPostCount: 1 })).toBe(false)
  })

  it('treats chat and typed views as unread badges', () => {
    expect(viewShowsUnreadBadge({ type: 'chat', newPostCount: 1 })).toBe(true)
    expect(viewShowsUnreadBadge({ type: 'events', newPostCount: 1 })).toBe(true)
    expect(viewShowsUnreadBadge({ type: 'all', newPostCount: 5 })).toBe(false)
  })

  describe('groupMenuHasUnreadBadges', () => {
    const membershipCounts = {}
    const getCount = (id) => membershipCounts[id] || 0

    beforeEach(() => {
      Object.keys(membershipCounts).forEach(key => { delete membershipCounts[key] })
    })

    it('is false when nothing is unread', () => {
      expect(groupMenuHasUnreadBadges({
        groupViews: { items: [{ type: 'chat', newPostCount: 0 }] }
      }, getCount)).toBe(false)
    })

    it('is true when a chat view is unread', () => {
      expect(groupMenuHasUnreadBadges({
        groupViews: { items: [{ type: 'chat', newPostCount: 2 }] }
      }, getCount)).toBe(true)
    })

    it('is true when a nested space has membership unread', () => {
      membershipCounts['space-1'] = 1
      expect(groupMenuHasUnreadBadges({
        groupViews: {
          items: [{
            type: 'space',
            linkedGroup: { id: 'space-1', groupViews: { items: [] } }
          }]
        }
      }, getCount)).toBe(true)
    })

    it('is true when a nested space view is unread', () => {
      expect(groupMenuHasUnreadBadges({
        groupViews: {
          items: [{
            type: 'space',
            linkedGroup: {
              id: 'space-1',
              groupViews: { items: [{ type: 'chat', newPostCount: 1 }] }
            }
          }]
        }
      }, getCount)).toBe(true)
    })

    it('is false when views and spaces are clear', () => {
      membershipCounts['space-1'] = 0
      expect(groupMenuHasUnreadBadges({
        groupViews: {
          items: [
            { type: 'chat', newPostCount: 0 },
            {
              type: 'space',
              linkedGroup: {
                id: 'space-1',
                groupViews: { items: [{ type: 'chat', newPostCount: 0 }] }
              }
            }
          ]
        }
      }, getCount)).toBe(false)
    })
  })
})
