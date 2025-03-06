import React from 'react'
import { useParams, useLocation, Routes, Route } from 'react-router-dom'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen, waitForElementToBeRemoved } from 'util/testing/reactTestingLibraryExtended'
import AuthLayout from './AuthLayout'

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
    <AuthLayout />,
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
    <AuthLayout />,
    { wrapper: testWrapper({}, ['/groups/no-group']) }
  )

  await waitForElementToBeRemoved(screen.queryByTestId('loading-screen'))

  expect(screen.getByText(`Oops, there's nothing to see here.`)).toBeInTheDocument()
})
