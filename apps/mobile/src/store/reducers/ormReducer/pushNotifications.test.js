import reducer from './pushNotifications'
import orm from 'store/models'
import { RECEIVE_PUSH_NOTIFICATION } from 'store/actions/receivePushNotification'

it('toggles the messages badge for a thread-related PN', () => {
  const session = orm.session(orm.getEmptyState())
  session.Me.create({ id: '1' })

  const action = {
    type: RECEIVE_PUSH_NOTIFICATION,
    payload: {
      payload: {
        additionalData: {
          path: '/t/7'
        }
      }
    }
  }

  reducer(session, action)
  expect(session.Me.first().unseenThreadCount).toBe(1)
})

it('does nothing yet for a non-thread-related PN', () => {
  const session = orm.session(orm.getEmptyState())
  session.Me.create({ id: '1' })

  const action = {
    type: RECEIVE_PUSH_NOTIFICATION,
    payload: {
      payload: {
        additionalData: {
          path: '/c/sandbox'
        }
      }
    }
  }

  reducer(session, action)
  expect(session.Me.first().unseenThreadCount).toBeUndefined()
})
