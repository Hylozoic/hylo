import {
  ormSessionReducer,
  RECEIVE_MESSAGE,
  RECEIVE_NOTIFICATION,
  RECEIVE_THREAD
} from './SocketListener.store'
import orm from 'store/models'

describe('ormSessionReducer', () => {
  let session
  beforeEach(() => {
    session = orm.session(orm.getEmptyState())
    session.Me.create({ id: '1' })
  })

  it('handles RECEIVE_MESSAGE', () => {
    session.MessageThread.create({ id: '1' })

    const date = new Date()
    const action = {
      type: RECEIVE_MESSAGE,
      payload: {
        data: {
          message: {
            messageThread: '1',
            createdAt: date
          }
        }
      }
    }

    ormSessionReducer(session, action)
    expect(session.MessageThread.withId('1').updatedAt).toEqual(date)
    expect(session.Me.first().unseenThreadCount).toBe(1)
  })

  it('handles RECEIVE_THREAD', () => {
    const action = {
      type: RECEIVE_THREAD
    }
    ormSessionReducer(session, action)
    expect(session.Me.first().unseenThreadCount).toBe(1)
  })

  it('handles RECEIVE_NOTIFICATION', () => {
    session.Post.create({ id: '2' })

    const action = {
      type: RECEIVE_NOTIFICATION,
      payload: {
        data: {
          notification: {
            activity: {
              action: 'newComment',
              post: {
                id: '2'
              }
            }
          }
        }
      }
    }

    ormSessionReducer(session, action)
    expect(session.Me.first().newNotificationCount).toBe(1)
    expect(session.Post.first().commentsTotal).toBe(1)
  })
})
