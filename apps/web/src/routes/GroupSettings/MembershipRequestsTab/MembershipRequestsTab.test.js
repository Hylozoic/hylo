import React from 'react'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import MembershipRequestsTab from './MembershipRequestsTab'

const group = { id: '1', name: 'Garden Club', slug: 'garden', joinQuestions: [] }

function joinRequest (id, user, invitedBy) {
  return {
    id,
    status: 0,
    createdAt: null,
    questionAnswers: [],
    group: { id: group.id, slug: group.slug },
    invitedBy,
    user: { ...user, avatarUrl: null, skills: { items: [] } }
  }
}

function providers () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '10', name: 'Steward' })
  return AllTheProviders({ orm: ormSession.state, pending: {} })
}

describe('MembershipRequestsTab', () => {
  it('shows which member invited each person who was invited', async () => {
    let requestedGroupId
    mockGraphqlServer.use(
      graphql.query('FetchJoinRequests', ({ variables }) => {
        requestedGroupId = variables.groupId
        return HttpResponse.json({
          data: {
            joinRequests: {
              total: 2,
              hasMore: false,
              items: [
                joinRequest('5', { id: '2', name: 'Grace Newcomer' }, { id: '7', name: 'Ada Member', avatarUrl: null }),
                joinRequest('6', { id: '3', name: 'Lin Walkin' }, null)
              ]
            }
          }
        })
      })
    )

    render(<MembershipRequestsTab group={group} />, null, providers())

    expect(await screen.findByText('Invited by Ada Member')).toBeInTheDocument()
    expect(requestedGroupId).toBe(group.id)
    expect(screen.getByText('Grace Newcomer')).toBeInTheDocument()
    expect(screen.getByText('Lin Walkin')).toBeInTheDocument()
    expect(screen.getAllByText(/^Invited by/)).toHaveLength(1)
    expect(document.querySelector('a[href="/all/members/7"]')).toBeInTheDocument()
  })
})
