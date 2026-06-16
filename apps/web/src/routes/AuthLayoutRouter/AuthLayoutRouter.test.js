import React from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen, waitForElementToBeRemoved } from 'util/testing/reactTestingLibraryExtended'
import AuthLayoutRouter from './AuthLayoutRouter'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ context: 'groups', groupSlug: 'test-group' }),
  useLocation: jest.fn().mockReturnValue({ pathname: '/groups/test-group', search: '' })
}))

const useParamsMocked = jest.mocked(useParams)
const useLocationMocked = jest.mocked(useLocation)

afterEach(() => {
  jest.restoreAllMocks()
})

const testWrapper = (providedState, initialEntries = []) => ({ children }) => {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  const reduxState = { orm: ormSession.state, ...providedState }

  const AllTheProvidersComponent = AllTheProviders(reduxState, initialEntries)
  return <AllTheProvidersComponent>{children}</AllTheProvidersComponent>
}

it('shows group if the group exists', async () => {
  const group = {
    id: '1',
    slug: 'test-group',
    name: 'Test Group'
  }
  const membership = { id: '1', person: { id: '1' }, group, commonRoles: { items: [] } }
  const me = {
    id: '1',
    name: 'Test User',
    hasRegistered: true,
    emailValidated: true,
    settings: {
      signupInProgress: false,
      alreadySeenTour: true
    },
    memberships: [
      membership
    ]
  }

  mockGraphqlServer.use(
    graphql.query('MeQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          me
        }
      })
    }),
    graphql.query('FetchForGroup', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          group
        }
      })
    }),
    graphql.query('GroupDetailsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          group
        }
      })
    }),
    graphql.query('GroupWelcomeQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: { group: null }
      })
    }),
    graphql.query('PostsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: { group: null }
      })
    }),
    graphql.query('GroupPostsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: { group: null }
      })
    }),
    // defaults
    graphql.query('MessageThreadsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: { me: null }
      })
    }),
    graphql.query('MyPendingJoinRequestsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: { joinRequests: null }
      })
    }),
    graphql.query('NotificationsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: { notifications: null }
      })
    }),
    graphql.query('FetchCommonRoles', ({ query, variables }) => {
      return HttpResponse.json({
        data: { commonRoles: [] }
      })
    }),
    graphql.query('FetchPlatformAgreements', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          platformAgreements: null
        }
      })
    })
  )

  render(
    <AuthLayoutRouter />,
    { wrapper: testWrapper({}, ['/groups/test-group']) }
  )

  await waitForElementToBeRemoved(screen.queryByTestId('loading-screen'))

  expect(screen.getByText('Stream')).toBeInTheDocument()
})

it('shows NotFound if the group does not exist', async () => {
  const me = {
    id: '1',
    name: 'Test User',
    hasRegistered: true,
    emailValidated: true,
    settings: {
      signupInProgress: false,
      alreadySeenTour: true
    },
    memberships: [{ id: '3', person: { id: '3' }, commonRoles: { items: [] } }]
  }

  mockGraphqlServer.use(
    graphql.query('MeQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          me
        }
      })
    }),
    graphql.query('FetchForGroup', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          group: null
        }
      })
    }),
    graphql.query('GroupDetailsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          group: null
        }
      })
    }),
    graphql.query('PostsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          group: null
        }
      })
    }),
    graphql.query('GroupPostsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          group: null
        }
      })
    }),
    // defaults
    graphql.query('MessageThreadsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          me: null
        }
      })
    }),
    graphql.query('MyPendingJoinRequestsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          joinRequests: null
        }
      })
    }),
    graphql.query('NotificationsQuery', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          notifications: null
        }
      })
    }),
    graphql.query('FetchCommonRoles', ({ query, variables }) => {
      return HttpResponse.json({
        data: { commonRoles: [] }
      })
    }),
    graphql.query('FetchPlatformAgreements', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          platformAgreements: null
        }
      })
    })
  )

  useParamsMocked.mockReturnValue({ context: 'groups', groupSlug: 'no-group' })
  useLocationMocked.mockReturnValue({ pathname: '/groups/no-group', search: '' })

  render(
    <AuthLayoutRouter />,
    { wrapper: testWrapper({}, ['/groups/no-group']) }
  )

  await waitForElementToBeRemoved(screen.queryByTestId('loading-screen'))

  expect(screen.getByText('Oops, there\'s nothing to see here.')).toBeInTheDocument()
})

const defaultBootstrapHandlers = () => [
  graphql.query('MeQuery', () => {
    return new Promise(() => {})
  }),
  graphql.query('FetchForGroup', () => {
    return HttpResponse.json({
      data: {
        group: {
          id: '1',
          slug: 'test-group',
          name: 'Test Group'
        }
      }
    })
  }),
  graphql.query('FetchPost', () => {
    return HttpResponse.json({
      data: {
        post: {
          id: '123',
          title: 'Test Post',
          details: 'Post body',
          type: 'discussion',
          creator: { id: '1', name: 'Creator', avatarUrl: '' },
          groups: [{ id: '1', slug: 'test-group', name: 'Test Group' }],
          commentersTotal: 0,
          commentsTotal: 0,
          comments: { items: [], hasMore: false, total: 0 },
          attachments: [],
          topics: []
        }
      }
    })
  }),
  graphql.query('GroupDetailsQuery', () => {
    return HttpResponse.json({ data: { group: null } })
  }),
  graphql.query('GroupWelcomeQuery', () => {
    return HttpResponse.json({ data: { group: null } })
  }),
  graphql.query('PostsQuery', () => {
    return HttpResponse.json({ data: { group: null } })
  }),
  graphql.query('GroupPostsQuery', () => {
    return HttpResponse.json({ data: { group: null } })
  }),
  graphql.query('MessageThreadsQuery', () => {
    return HttpResponse.json({ data: { me: null } })
  }),
  graphql.query('MyPendingJoinRequestsQuery', () => {
    return HttpResponse.json({ data: { joinRequests: null } })
  }),
  graphql.query('NotificationsQuery', () => {
    return HttpResponse.json({ data: { notifications: null } })
  }),
  graphql.query('FetchCommonRoles', () => {
    return HttpResponse.json({ data: { commonRoles: [] } })
  }),
  graphql.query('FetchPlatformAgreements', () => {
    return HttpResponse.json({ data: { platformAgreements: null } })
  })
]

it('skips full-page bootstrap shell for post-detail deep links', () => {
  mockGraphqlServer.use(...defaultBootstrapHandlers())

  useParamsMocked.mockReturnValue({
    context: 'groups',
    groupSlug: 'test-group',
    view: 'stream',
    postId: '123'
  })
  useLocationMocked.mockReturnValue({
    pathname: '/groups/test-group/stream/post/123',
    search: ''
  })

  render(
    <AuthLayoutRouter />,
    { wrapper: testWrapper({}, ['/groups/test-group/stream/post/123']) }
  )

  expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument()
  expect(document.getElementById('center-column-container')).toBeInTheDocument()
})

it('shows full-page bootstrap shell for non-post routes while user loads', () => {
  mockGraphqlServer.use(...defaultBootstrapHandlers())

  useParamsMocked.mockReturnValue({ context: 'groups', groupSlug: 'test-group' })
  useLocationMocked.mockReturnValue({ pathname: '/groups/test-group', search: '' })

  render(
    <AuthLayoutRouter />,
    { wrapper: testWrapper({}, ['/groups/test-group']) }
  )

  expect(screen.getByTestId('loading-screen')).toBeInTheDocument()
})
