import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { TestRoot } from 'util/testing'
import NotificationsList from './NotificationsList'
import { ACTION_NEW_COMMENT } from './NotificationsList.store'
import MockedScreen from 'util/testing/MockedScreen'
import extractModelsForTest from 'util/testing/extractModelsFromAction'
import orm from 'store/models'

jest.mock('util/platform', () => ({ isIOS: true }))

const ormSession = orm.mutableSession(orm.getEmptyState())
const reduxState = {
  pending: {},
  orm: ormSession.state
}

const testNotifications = [
  {
    id: '1',
    activity: {
      id: '1',
      unread: true,
      meta: {
        reasons: [ACTION_NEW_COMMENT]
      },
      actor: {
        id: '1',
        name: 'Foo Bar',
        avatarUrl: 'https://example.com/1.png'
      },
      comment: {
        id: '1',
        text: 'A comment'
      }
    }
  }
]

extractModelsForTest({
  notifications: {
    total: testNotifications.length,
    hasMore: false,
    items: testNotifications
  }
}, 'Notification', ormSession)

extractModelsForTest({
  me: {
    id: '882828',
    name: 'person person',
    memberships: [
      {
        id: '2090984',
        person: { id: '882828' },
        group: { id: '99409848' }
      }
    ]
  }
}, 'Me', ormSession)

describe('NotificationsList', () => {
  it('matches the last snapshot', () => {
    render(
      <TestRoot state={reduxState}>
        <MockedScreen>
          {screenProps => (
            <NotificationsList {...screenProps} />
          )}
        </MockedScreen>
      </TestRoot>
    )

    expect(screen.toJSON()).toMatchSnapshot()
  })

  it('Shows Loading when pending is true', () => {
    render(
      <TestRoot state={reduxState}>
        <MockedScreen>
          {screenProps => (
            <NotificationsList {...screenProps} />
          )}
        </MockedScreen>
      </TestRoot>
    )

    screen.getByA11yHint('loading')
  })
})
