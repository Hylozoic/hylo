import orm from '../../../../../store/models'
import queryResults from '../../../../../store/reducers/queryResults'
import {
  fetchNotifications,
  getHasMoreNotifications,
  getNotifications
} from './NotificationsDropdown.store'

describe('getNotifications', () => {
  it('returns expected values', () => {
    const session = orm.session(orm.getEmptyState())
    const notification1 = session.Notification.create({ id: 1 })
    const notification2 = session.Notification.create({ id: 2 })
    const notifications = getNotifications({ orm: session.state }, {})
    expect(notifications.length).toEqual(2)
    expect(notifications[0]).toEqual(notification2)
    expect(notifications[1]).toEqual(notification1)
  })
})

describe('getHasMoreNotifications', () => {
  it('reads hasMore after a paginated fetch that includes first and offset', () => {
    const action = {
      ...fetchNotifications(20, 20),
      payload: {
        data: {
          notifications: {
            total: 40,
            hasMore: true,
            items: [{ id: 21 }, { id: 22 }]
          }
        }
      }
    }

    const state = { queryResults: queryResults({}, action) }

    expect(getHasMoreNotifications(state)).toEqual(true)
  })
})
