/* eslint-env jest */
import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import ViewContent from './ViewContent'

function providers ({ withMembership }) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1', name: 'Test User', settings: {} })
  if (withMembership) {
    ormSession.Group.create({ id: '1', name: 'Test Group', slug: 'test-group' })
    ormSession.Membership.create({ id: '1', group: '1', person: '1' })
  }
  return AllTheProviders({ orm: ormSession.state })
}

describe('ViewContent empty stream', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('PostsQuery', () => HttpResponse.json({
        data: { posts: { hasMore: false, total: 0, items: [] } }
      }))
    )
  })

  it('points someone who is in no groups to exploring or creating one', async () => {
    render(<ViewContent context='all' view='stream' />, { wrapper: providers({ withMembership: false }) })

    expect(await screen.findByText('You\'re not in any groups yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Explore Groups' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create a group' })).toBeInTheDocument()
  })

  it('keeps the usual empty message for group members', async () => {
    render(<ViewContent context='all' view='stream' />, { wrapper: providers({ withMembership: true }) })

    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument()
    expect(screen.queryByText('You\'re not in any groups yet')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Explore Groups' })).not.toBeInTheDocument()
  })
})
