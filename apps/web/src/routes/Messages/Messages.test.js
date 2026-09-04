import React from 'react'
import { render, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import Messages from './Messages'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ messageThreadId: '1' })
}))

jest.mock('util/mobile', () => ({
  ...jest.requireActual('util/mobile'),
  isPhoneDevice: () => false,
  isMobileDevice: () => false
}))

describe('Messages component', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('MessageThreadsQuery', () => {
        return HttpResponse.json({
          data: {
            me: {
              id: '1',
              messageThreads: {
                items: [{
                  id: '1',
                  unreadCount: 0,
                  lastReadAt: null,
                  createdAt: null,
                  updatedAt: null,
                  participants: [],
                  messages: { items: [] }
                }]
              }
            }
          }
        })
      }),
      graphql.query('MessageThreadQuery', () => {
        return HttpResponse.json({
          data: {
            messageThread: {
              id: '1',
              unreadCount: 0,
              lastReadAt: null,
              createdAt: null,
              updatedAt: null,
              participants: [],
              messages: { items: [] }
            }
          }
        })
      }),
      graphql.query('PeopleQuery', () => {
        return HttpResponse.json({
          data: {
            groups: {
              items: [{
                id: '1',
                members: { items: [{ id: '1', name: 'John Doe', avatarUrl: 'https://example.com/avatar.jpg' }] }
              }]
            }
          }
        })
      })
    )
  })

  it('renders without crashing', () => {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Me.create({ id: '1', name: 'Test User' })

    const { container } = render(
      <Messages />,
      null,
      AllTheProviders({ orm: ormSession.state })
    )

    expect(container.querySelector('#root') || container).toBeTruthy()
  })
})
