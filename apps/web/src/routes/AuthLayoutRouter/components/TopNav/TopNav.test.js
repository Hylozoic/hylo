import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import TopNav from './TopNav'

jest.mock('react-use-intercom', () => ({
  useIntercom: () => ({ show: () => {} })
}))

describe('TopNav', () => {
  it('renders as expected with no group', async () => {
    const me = {
      id: '1',
      name: 'Test User',
      hasRegistered: true,
      emailValidated: true,
      settings: {
        signupInProgress: false,
        alreadySeenTour: true
      }
    }

    mockGraphqlServer.use(
      graphql.query('MeQuery', () => {
        return HttpResponse.json({
          data: {
            me
          }
        })
      }),
      graphql.query('FetchForGroup', () => {
        return HttpResponse.json({
          data: {
            group: null
          }
        })
      }),
      graphql.query('GroupDetailsQuery', () => {
        return HttpResponse.json({
          data: {
            group: null
          }
        })
      }),
      graphql.query('PostsQuery', () => {
        return HttpResponse.json({
          data: {
            group: null
          }
        })
      }),
      graphql.query('GroupPostsQuery', () => {
        return HttpResponse.json({
          data: {
            group: null
          }
        })
      }),
      // defaults
      graphql.query('MessageThreadsQuery', () => {
        return HttpResponse.json({
          data: {
            me: null
          }
        })
      }),
      graphql.query('MyPendingJoinRequestsQuery', () => {
        return HttpResponse.json({
          data: {
            joinRequests: null
          }
        })
      }),
      graphql.query('NotificationsQuery', () => {
        return HttpResponse.json({
          data: {
            notifications: null
          }
        })
      })
    )

    render(
      <TopNav routeParams={{ context: 'all', view: 'stream' }} />
    )

    await waitFor(() => {
      expect(screen.getByText("You don't have any messages yet")).toBeInTheDocument()
    })
  })
})
