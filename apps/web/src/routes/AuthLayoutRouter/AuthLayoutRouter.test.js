import React from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen, waitForElementToBeRemoved, waitFor } from 'util/testing/reactTestingLibraryExtended'
import AuthLayoutRouter from './AuthLayoutRouter'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ context: 'groups', groupSlug: 'test-group' }),
  useLocation: jest.fn().mockReturnValue({ pathname: '/groups/test-group', search: '' })
}))

const useParamsMocked = jest.mocked(useParams)
const useLocationMocked = jest.mocked(useLocation)

const defaultGraphqlHandlers = () => [
  graphql.query('MessageThreadsQuery', () => HttpResponse.json({ data: { me: null } })),
  graphql.query('MyPendingJoinRequestsQuery', () => HttpResponse.json({ data: { joinRequests: null } })),
  graphql.query('NotificationsQuery', () => HttpResponse.json({ data: { notifications: null } })),
  graphql.query('FetchPlatformAgreements', () => HttpResponse.json({ data: { platformAgreements: null } })),
  graphql.query('GroupWelcomeQuery', () => HttpResponse.json({ data: { group: null } })),
  graphql.query('PostsQuery', () => HttpResponse.json({ data: { group: null } })),
  graphql.query('GroupPostsQuery', () => HttpResponse.json({ data: { group: null } })),
  graphql.query('FetchGroupViews', () => HttpResponse.json({ data: { group: null } })),
  graphql.query('FetchGroupSpaces', () => HttpResponse.json({ data: { group: null } })),
  graphql.operation(() => HttpResponse.json({ data: {} }))
]

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
  const membership = {
    id: '1',
    person: { id: '1' },
    group,
    settings: {
      showJoinForm: false,
      joinQuestionsAnsweredAt: '2020-01-01T00:00:00.000Z'
    }
  }
  const me = {
    id: '1',
    name: 'Test User',
    hasRegistered: true,
    emailValidated: true,
    settings: {
      signupInProgress: false,
      alreadySeenTour: true
    },
    memberships: [membership]
  }

  useParamsMocked.mockReturnValue({ context: 'groups', groupSlug: 'test-group' })
  useLocationMocked.mockReturnValue({ pathname: '/groups/test-group', search: '' })

  mockGraphqlServer.use(
    graphql.query('MeQuery', () => HttpResponse.json({ data: { me } })),
    graphql.query('FetchForGroup', () => HttpResponse.json({ data: { group } })),
    graphql.query('GroupDetailsQuery', () => HttpResponse.json({ data: { group } })),
    ...defaultGraphqlHandlers()
  )

  render(
    <AuthLayoutRouter />,
    { wrapper: testWrapper({}, ['/groups/test-group']) }
  )

  await waitForElementToBeRemoved(screen.queryByTestId('loading-screen'))

  await waitFor(() => {
    expect(screen.getByText('Test Group')).toBeInTheDocument()
  })
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
    memberships: [{ id: '3', person: { id: '3' } }]
  }

  useParamsMocked.mockReturnValue({ context: 'groups', groupSlug: 'no-group' })
  useLocationMocked.mockReturnValue({ pathname: '/groups/no-group', search: '' })

  mockGraphqlServer.use(
    graphql.query('MeQuery', () => HttpResponse.json({ data: { me } })),
    graphql.query('FetchForGroup', () => HttpResponse.json({ data: { group: null } })),
    graphql.query('GroupDetailsQuery', () => HttpResponse.json({ data: { group: null } })),
    ...defaultGraphqlHandlers()
  )

  render(
    <AuthLayoutRouter />,
    { wrapper: testWrapper({}, ['/groups/no-group']) }
  )

  await waitForElementToBeRemoved(screen.queryByTestId('loading-screen'))

  await waitFor(() => {
    expect(screen.getByText('Oops, there\'s nothing to see here.')).toBeInTheDocument()
  })
})
