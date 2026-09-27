import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import orm from 'store/models'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import GlobalNav from './GlobalNav'

jest.mock('react-use-intercom', () => ({
  useIntercom: () => ({ show: () => {} })
}))

function providersWithMe () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({
    id: '1',
    name: 'Test User',
    hasRegistered: true,
    emailValidated: true,
    settings: {
      signupInProgress: false,
      alreadySeenTour: true
    }
  })
  return AllTheProviders({ orm: ormSession.state })
}

describe('GlobalNav', () => {
  it('renders as expected with no group', async () => {
    mockGraphqlServer.use(
      graphql.query('MeQuery', () => HttpResponse.json({ data: { me: null } })),
      graphql.query('FetchForGroup', () => HttpResponse.json({ data: { group: null } })),
      graphql.query('GroupDetailsQuery', () => HttpResponse.json({ data: { group: null } })),
      graphql.query('PostsQuery', () => HttpResponse.json({ data: { group: null } })),
      graphql.query('GroupPostsQuery', () => HttpResponse.json({ data: { group: null } })),
      graphql.query('MessageThreadsQuery', () => HttpResponse.json({ data: { me: null } })),
      graphql.query('MyPendingJoinRequestsQuery', () => HttpResponse.json({ data: { joinRequests: null } })),
      graphql.query('NotificationsQuery', () => HttpResponse.json({ data: { notifications: null } }))
    )

    const { container } = render(
      <GlobalNav routeParams={{ context: 'all', view: 'all' }} />,
      { wrapper: providersWithMe() }
    )

    await waitFor(() => {
      expect(container.querySelector('.globalNavContainer')).toBeInTheDocument()
    })
  })

  it('exposes Settings and Help as named buttons', async () => {
    render(
      <GlobalNav routeParams={{ context: 'all', view: 'all' }} />,
      { wrapper: providersWithMe() }
    )

    expect(await screen.findByRole('button', { name: 'Settings' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Help' })).toHaveAttribute('type', 'button')
  })
})
