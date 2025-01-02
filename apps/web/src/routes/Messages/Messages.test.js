import React from 'react'
import { render, screen, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import Messages from './Messages'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ threadId: '1' }),
}))


describe('Messages component', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('MessageThreadsQuery', ({ query, variables }) => {
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
      graphql.query('MessageThreadQuery', ({ query, variables }) => {
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
      graphql.query('PeopleQuery', ({ query, variables }) => {
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

  it('renders loading state', async () => {
    render(
      <Messages />,
      { wrapper: AllTheProviders() }
    )

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('renders messages title when not loading', async () => {
    render(
      <Messages />,
      { wrapper: AllTheProviders() }
    )

    // Wait for the loading state to finish
    await waitFor(() => {
      expect(screen.getByText(/Messages/i)).toBeInTheDocument()
    })
  })

  it('renders thread list when not loading', async () => {
    render(
      <Messages />,
      { wrapper: AllTheProviders() }
    )

    // Wait for the loading state to finish
    await waitFor(() => {
      expect(screen.getByText(/Messages/i)).toBeInTheDocument()
      expect(screen.getByRole('list')).toBeInTheDocument()
    })
  })

  // Add more tests as needed for specific functionality
})
