import {
  ormSessionReducer,
  RECEIVE_MESSAGE,
  RECEIVE_MESSAGE_UPDATED,
  RECEIVE_POST,
  RECEIVE_NOTIFICATION
} from './SocketListener.store'
import orm from 'store/models'

describe('SocketListener.store.ormSessionReducer', () => {
  let session

  beforeEach(() => {
    session = orm.mutableSession(orm.getEmptyState())
  })

  it('responds to RECEIVE_MESSAGE', () => {
    session.Me.create({ id: '1', unseenThreadCount: 0 })
    const action = {
      type: RECEIVE_MESSAGE,
      payload: {
        data: {
          message: {
            text: 'hello world',
            messageThread: '7'
          }
        }
      },
      meta: {
        bumpUnreadCount: true
      }
    }

    ormSessionReducer(session, action)
    const thread = session.MessageThread.withId('7')
    expect(thread.unreadCount).toBe(1)
    expect(session.Me.first().unseenThreadCount).toBe(1)
  })

  it('does not bump unseenThreadCount for muted threads', () => {
    session.Me.create({ id: '1', unseenThreadCount: 0 })
    session.MessageThread.create({
      id: '7',
      unreadCount: 0,
      isMuted: true
    })
    const action = {
      type: RECEIVE_MESSAGE,
      payload: {
        data: {
          message: {
            text: 'hello world',
            messageThread: '7'
          }
        }
      },
      meta: {
        bumpUnreadCount: true
      }
    }

    ormSessionReducer(session, action)
    expect(session.MessageThread.withId('7').unreadCount).toBe(1)
    expect(session.Me.first().unseenThreadCount).toBe(0)
  })

  it('responds to RECEIVE_MESSAGE_UPDATED', () => {
    session.Message.create({
      id: '99',
      text: 'old text',
      messageThread: '7'
    })
    const action = {
      type: RECEIVE_MESSAGE_UPDATED,
      payload: {
        data: {
          message: {
            id: '99',
            text: 'new text',
            editedAt: '2024-01-01T00:00:00.000Z'
          }
        }
      }
    }

    ormSessionReducer(session, action)
    const message = session.Message.withId('99')
    expect(message.text).toBe('new text')
    expect(message.editedAt).toBe(new Date('2024-01-01T00:00:00.000Z').toString())
  })

  describe('for RECEIVE_POST', () => {
    let action

    beforeEach(() => {
      session.Me.create({ id: '2' })
      session.Person.create({ id: '2' })
      session.Group.create({
        id: '1',
        name: 'place',
        groupViews: {
          items: [
            { id: '10', type: 'chat', newPostCount: 0 },
            { id: '11', type: 'discussions', newPostCount: 0 }
          ]
        }
      })
      session.Membership.create({ id: '1', group: '1', person: '2', newPostCount: 0 })
      action = {
        type: RECEIVE_POST,
        payload: {
          groupId: '1',
          data: {
            post: {
              type: 'discussion',
              topics: [{ id: '2' }],
              creator: { id: '4' }
            }
          }
        }
      }
    })

    it('updates membership and GroupView unread counts', () => {
      ormSessionReducer(session, action)
      expect(session.Membership.withId('1').newPostCount).toBe(1)
      const views = session.Group.withId('1').groupViews.items
      expect(views.find(v => v.type === 'discussions').newPostCount).toBe(1)
      expect(views.find(v => v.type === 'chat').newPostCount).toBe(1)
    })

    it('ignores posts created by the current user', () => {
      action.payload.data.post.creator = { id: '2' }
      ormSessionReducer(session, action)
      expect(session.Membership.withId('1').newPostCount).toBe(0)
      const views = session.Group.withId('1').groupViews.items
      expect(views.find(v => v.type === 'discussions').newPostCount).toBe(0)
      expect(views.find(v => v.type === 'chat').newPostCount).toBe(0)
    })

    it('updates nested space menus on the parent group', () => {
      session.Group.create({
        id: '99',
        name: 'parent',
        groupViews: {
          items: [
            {
              id: 'space-view',
              type: 'space',
              linkedGroup: {
                id: '1',
                settings: { showPostNoticesInChat: true },
                groupViews: {
                  items: [
                    { id: '10', type: 'chat', newPostCount: 0 },
                    { id: '11', type: 'discussions', newPostCount: 0 }
                  ]
                }
              }
            }
          ]
        }
      })
      // Space's own Group may not have groupViews loaded — nested parent menu still updates
      session.Group.withId('1').update({ groupViews: null })

      ormSessionReducer(session, action)

      const nested = session.Group.withId('99').groupViews.items[0].linkedGroup.groupViews.items
      expect(nested.find(v => v.type === 'discussions').newPostCount).toBe(1)
      expect(nested.find(v => v.type === 'chat').newPostCount).toBe(1)
      expect(session.Membership.withId('1').newPostCount).toBe(1)
    })
  })

  it('responds to RECEIVE_NOTIFICATION', () => {
    session.Me.create({ id: '77', newNotificationCount: 2 })
    const action = {
      type: RECEIVE_NOTIFICATION
    }
    ormSessionReducer(session, action)
    expect(session.Me.first().newNotificationCount).toBe(3)
  })
})
