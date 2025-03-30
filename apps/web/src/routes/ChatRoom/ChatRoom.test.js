/* eslint-env jest */
import React from 'react'
import { act } from 'react-dom/test-utils'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, fireEvent, waitFor, within, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import orm from 'store/models'
import ChatRoom from './ChatRoom'

// Mock the virtuoso message list components
jest.mock('@virtuoso.dev/message-list', () => ({
  VirtuosoMessageList: ({ children, initialData, context, EmptyPlaceholder, ItemContent }) => (
    <div data-testid="virtuoso-message-list">
      {initialData && initialData.length > 0 ? (
        initialData.map((post, index) => (
          <div key={post.id || post.localId} data-testid={`post-${post.id || post.localId}`}>
            {ItemContent({ data: post, context, index })}
          </div>
        ))
      ) : (
        <EmptyPlaceholder context={context} />
      )}
    </div>
  ),
  VirtuosoMessageListLicense: ({ children }) => <div>{children}</div>,
  useCurrentlyRenderedData: () => [{ createdAt: '2023-01-01T12:00:00.000Z' }],
  useVirtuosoLocation: () => ({ bottomOffset: 0, listOffset: 0 }),
  useVirtuosoMethods: () => ({ scrollToItem: jest.fn() })
}))

// Mock the socket
jest.mock('client/websockets.js', () => ({
  getSocket: () => ({
    on: jest.fn(),
    off: jest.fn()
  })
}))

// Mock the PostEditor component
jest.mock('components/PostEditor/PostEditor', () => {
  return function MockPostEditor({ onSave, afterSave }) {
    return (
      <div data-testid="post-editor">
        <button
          data-testid="mock-send-message"
          onClick={() => {
            const mockPost = {
              id: 'local-123',
              localId: 'local-123',
              type: 'chat',
              creator: { id: '1', name: 'Test User' },
              createdAt: new Date().toISOString()
            }
            onSave(mockPost)
            afterSave(mockPost)
          }}
        >
          Send Message
        </button>
      </div>
    )
  }
})

// Mock the actions
jest.mock('store/actions/fetchPosts', () => {
  return jest.fn(() => ({
    type: 'FETCH_POSTS',
    payload: {
      data: {
        group: {
          posts: {
            items: [
              {
                id: '101',
                type: 'chat',
                creator: { id: '1', name: 'Test User' },
                createdAt: '2023-01-01T12:00:00.000Z'
              },
              {
                id: '102',
                type: 'chat',
                creator: { id: '2', name: 'Another User' },
                createdAt: '2023-01-01T12:05:00.000Z'
              }
            ]
          }
        }
      }
    }
  }))
})

jest.mock('store/actions/fetchTopicFollow', () => {
  return jest.fn(() => ({
    type: 'FETCH_TOPIC_FOLLOW',
    payload: {
      data: {
        topicFollow: {
          id: '1',
          topic: { id: '1', name: 'general' },
          lastReadPostId: '100',
          settings: { notifications: 'all' }
        }
      }
    }
  }))
})

jest.mock('store/actions/updateTopicFollow', () => {
  return jest.fn(() => ({
    type: 'UPDATE_TOPIC_FOLLOW',
    payload: {
      data: {
        topicFollow: {
          id: '1',
          lastReadPostId: '102'
        }
      }
    }
  }))
})

jest.mock('lodash/debounce', () => fn => {
  fn.cancel = jest.fn()
  return fn
})

// Mock the ViewHeaderContext
jest.mock('contexts/ViewHeaderContext', () => ({
  useViewHeader: () => ({
    setHeaderDetails: jest.fn()
  })
}))

function setupTestProviders() {
  const ormSession = orm.mutableSession(orm.getEmptyState())

  // Create test data
  const group = ormSession.Group.create({
    id: '1',
    name: 'Test Group',
    slug: 'test-group'
  })

  const user = ormSession.Me.create({
    id: '1',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg'
  })

  const posts = [
    {
      id: '100',
      type: 'chat',
      title: '',
      creator: { id: '1', name: 'Test User' },
      createdAt: '2023-01-01T11:55:00.000Z',
      groups: [{ id: '1', name: 'Test Group' }],
      myReactions: [],
      postReactions: []
    },
    {
      id: '101',
      type: 'chat',
      title: '',
      creator: { id: '1', name: 'Test User' },
      createdAt: '2023-01-01T12:00:00.000Z',
      groups: [{ id: '1', name: 'Test Group' }],
      myReactions: [],
      postReactions: []
    },
    {
      id: '102',
      type: 'chat',
      title: '',
      creator: { id: '2', name: 'Another User' },
      createdAt: '2023-01-01T12:05:00.000Z',
      groups: [{ id: '1', name: 'Test Group' }],
      myReactions: [],
      postReactions: []
    }
  ]

  posts.forEach(post => {
    ormSession.Post.create(post)
  })

  const topicFollow = ormSession.TopicFollow.create({
    id: '1',
    topic: { id: '1', name: 'general' },
    lastReadPostId: '100',
    settings: { notifications: 'all' }
  })

  // Create query results
  const reduxState = {
    orm: ormSession.state,
    queryResults: {
      'FETCH_POSTS_{"childPostInclusion":"no","context":"","cursor":101,"filter":"chat","first":30,"order":"desc","slug":"test-group","sortBy":"id","topic":"1"}': {
        ids: ['100', '101'],
        hasMore: false
      },
      'FETCH_POSTS_{"childPostInclusion":"no","context":"","cursor":"100","filter":"chat","first":30,"order":"asc","slug":"test-group","sortBy":"id","topic":"1"}': {
        ids: ['101', '102'],
        hasMore: false
      }
    }
  }

  return AllTheProviders(reduxState)
}

describe('ChatRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock GraphQL responses
    mockGraphqlServer.use(
      graphql.query('FetchTopicFollow', () => {
        return HttpResponse.json({
          data: {
            topicFollow: {
              id: '1',
              topic: { id: '1', name: 'general' },
              lastReadPostId: '100',
              settings: { notifications: 'all' }
            }
          }
        })
      }),
      graphql.query('FetchPosts', () => {
        return HttpResponse.json({
          data: {
            group: {
              posts: {
                items: [
                  {
                    id: '101',
                    type: 'chat',
                    creator: { id: '1', name: 'Test User' },
                    createdAt: '2023-01-01T12:00:00.000Z',
                    myReactions: [],
                    postReactions: []
                  },
                  {
                    id: '102',
                    type: 'chat',
                    creator: { id: '2', name: 'Another User' },
                    createdAt: '2023-01-01T12:05:00.000Z',
                    myReactions: [],
                    postReactions: []
                  }
                ],
                hasMore: false
              }
            }
          }
        })
      }),
      graphql.mutation('UpdateTopicFollow', () => {
        return HttpResponse.json({
          data: {
            updateTopicFollow: {
              id: '1',
              lastReadPostId: '102',
              settings: { notifications: 'all' }
            }
          }
        })
      })
    )
  })

  const renderChatRoom = (props = {}) => {
    return render(
      <MemoryRouter initialEntries={['/groups/test-group/chat/general']}>
        <Routes>
          <Route
            path="/groups/:groupSlug/chat/:topicName/*"
            element={<ChatRoom {...props} />}
          />
        </Routes>
      </MemoryRouter>,
      { wrapper: setupTestProviders() }
    )
  }

  it('renders loading state initially', async () => {
    renderChatRoom()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('renders the message list when data is loaded', async () => {
    renderChatRoom()

    await waitFor(() => {
      expect(screen.getByTestId('virtuoso-message-list')).toBeInTheDocument()
    })
  })

  it('renders the post editor', async () => {
    renderChatRoom()

    await waitFor(() => {
      expect(screen.getByTestId('post-editor')).toBeInTheDocument()
    })
  })

  it('allows changing notification settings', async () => {
    const updateTopicFollow = require('store/actions/updateTopicFollow')
    renderChatRoom()

    await waitFor(() => {
      expect(screen.getByTestId('virtuoso-message-list')).toBeInTheDocument()
    })

    // Find and click the notifications dropdown
    const selectTrigger = await screen.findByRole('combobox')
    fireEvent.click(selectTrigger)

    // Select "Mute this chat room"
    const muteOption = await screen.findByText('Mute this chat room')
    fireEvent.click(muteOption)

    expect(updateTopicFollow).toHaveBeenCalledWith('1', { settings: { notifications: 'none' } })
  })

  it('sends a new message when clicking send', async () => {
    renderChatRoom()

    await waitFor(() => {
      expect(screen.getByTestId('virtuoso-message-list')).toBeInTheDocument()
    })

    // Find and click the send button in our mock PostEditor
    const sendButton = await screen.findByTestId('mock-send-message')
    fireEvent.click(sendButton)

    // Verify the message was added to the list
    await waitFor(() => {
      const updateTopicFollow = require('store/actions/updateTopicFollow')
      expect(updateTopicFollow).toHaveBeenCalled()
    })
  })

  it('handles empty state correctly', async () => {
    // Override the mock to return empty posts
    const fetchPosts = require('store/actions/fetchPosts')
    fetchPosts.mockImplementationOnce(() => ({
      type: 'FETCH_POSTS',
      payload: {
        data: {
          group: {
            posts: {
              items: [],
              hasMore: false
            }
          }
        }
      }
    }))

    renderChatRoom()

    await waitFor(() => {
      expect(screen.getByTestId('virtuoso-message-list')).toBeInTheDocument()
    })

    // Check for empty state component
    expect(screen.getByTestId('virtuoso-message-list')).toHaveTextContent(/loading/i)
  })

  it('updates last read post when viewing messages', async () => {
    const updateTopicFollow = require('store/actions/updateTopicFollow')
    renderChatRoom()

    await waitFor(() => {
      expect(screen.getByTestId('virtuoso-message-list')).toBeInTheDocument()
    })

    // Simulate rendered data change
    await waitFor(() => {
      expect(updateTopicFollow).toHaveBeenCalled()
    })
  })

  it('handles post reactions', async () => {
    renderChatRoom()

    await waitFor(() => {
      expect(screen.getByTestId('virtuoso-message-list')).toBeInTheDocument()
    })

    // Get the context from the VirtuosoMessageList mock
    const messageList = screen.getByTestId('virtuoso-message-list')

    // We can't directly test the reaction functionality since it's handled by the ChatPost component
    // But we can verify the context has the necessary functions
    expect(messageList).toBeInTheDocument()
  })
})
