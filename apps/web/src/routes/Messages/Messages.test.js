import React from 'react'
import orm from 'store/models'
import { render, screen, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import Messages from './Messages'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ messageThreadId: '1' }),
}))

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  const reduxState = { orm: ormSession.state }

  return AllTheProviders(reduxState)
}

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
                  createdAt: '2024-03-20T10:00:00Z',
                  updatedAt: '2024-03-20T10:00:00Z',
                  participants: [
                    {
                      id: '1',
                      name: 'John Doe',
                      avatarUrl: 'https://example.com/avatar1.jpg'
                    },
                    {
                      id: '2',
                      name: 'Jane Smith',
                      avatarUrl: 'https://example.com/avatar2.jpg'
                    }
                  ],
                  messages: {
                    items: [
                      {
                        id: '1',
                        text: 'Hello there!',
                        creator: {
                          id: '1',
                          name: 'John Doe',
                          avatarUrl: 'https://example.com/avatar1.jpg'
                        },
                        createdAt: '2024-03-20T10:00:00Z'
                      },
                      {
                        id: '2',
                        text: 'Hi John, how are you?',
                        creator: {
                          id: '2',
                          name: 'Jane Smith',
                          avatarUrl: 'https://example.com/avatar2.jpg'
                        },
                        createdAt: '2024-03-20T10:01:00Z'
                      }
                    ]
                  }
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
              createdAt: '2024-03-20T10:00:00Z',
              updatedAt: '2024-03-20T10:00:00Z',
              participants: [
                {
                  id: '1',
                  name: 'John Doe',
                  avatarUrl: 'https://example.com/avatar1.jpg'
                },
                {
                  id: '2',
                  name: 'Jane Smith',
                  avatarUrl: 'https://example.com/avatar2.jpg'
                }
              ],
              messages: {
                items: [
                  {
                    id: '1',
                    text: 'Hello there!',
                    creator: {
                      id: '1',
                      name: 'John Doe',
                      avatarUrl: 'https://example.com/avatar1.jpg'
                    },
                    createdAt: '2024-03-20T10:00:00Z'
                  },
                  {
                    id: '2',
                    text: 'Hi John, how are you?',
                    creator: {
                      id: '2',
                      name: 'Jane Smith',
                      avatarUrl: 'https://example.com/avatar2.jpg'
                    },
                    createdAt: '2024-03-20T10:01:00Z'
                  }
                ]
              }
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

  it('renders messages title when not loading', async () => {
    render(
      <Messages />,
      { wrapper: testProviders() }
    )

    // Wait for the loading state to finish
    await waitFor(() => {
      expect(document.title).toContain('Messages')
    })
  })

  it('renders thread list when not loading', async () => {
    render(
      <Messages />,
      { wrapper: testProviders() }
    )

    // Wait for the loading state to finish
    await waitFor(() => {
      expect(screen.getByLabelText(/message section/i)).toBeInTheDocument()
    })
  })

  it('displays two messages in the message thread', async () => {
    render(
      <Messages />,
      { wrapper: testProviders() }
    )

    // Wait for the loading state to finish and messages to be displayed
    await waitFor(() => {
      // Check for both message texts
      expect(screen.getByText('Hello there!')).toBeInTheDocument()
      expect(screen.getByText('Hi John, how are you?')).toBeInTheDocument()
      
      // Check for both sender names
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
  })

  // Add more tests as needed for specific functionality
})
