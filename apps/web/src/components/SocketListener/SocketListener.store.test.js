import {
  ormSessionReducer,
  RECEIVE_MESSAGE,
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
    session.Me.create({ id: '2' })
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
  })

  describe('for RECEIVE_POST', () => {
    let action

    beforeEach(() => {
      session.Me.create({ id: '2' })
      session.Person.create({ id: '4' })
      session.Group.create({
        id: '1',
        name: 'place',
        contextWidgets: { items: [] }
      })
      session.Membership.create({ id: '1', group: '1' })
      session.Membership.create({ id: '2', group: '1', person: '4' })
      session.TopicFollow.create({ id: '1', topic: '2', group: '1' })
      session.TopicFollow.create({ id: '2', topic: '7', group: '1' })
      session.TopicFollow.create({ id: '3', topic: '7', group: '2' })
      action = {
        type: RECEIVE_POST,
        payload: {
          data: {
            post: {
              id: 44,
              topics: [{ id: '2' }, { id: '7' }],
              groupId: '1',
              creator: { id: '4' }
            }
          },
          groupId: '1'
        }
      }
    })

    it('updates new post counts', () => {
      ormSessionReducer(session, action)
      expect(session.Membership.withId('1').newPostCount).toBe(1)
      expect(session.Membership.withId('2').newPostCount).toBeFalsy()
      expect(session.TopicFollow.withId('1').newPostCount).toBe(1)
      expect(session.TopicFollow.withId('2').newPostCount).toBeFalsy()
      expect(session.TopicFollow.withId('3').newPostCount).toBeFalsy()
    })

    it('ignores posts created by the current user', () => {
      action.payload.data.post.creator.id = '2'
      ormSessionReducer(session, action)
      expect(session.Membership.withId('1').newPostCount).toBeFalsy()
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
