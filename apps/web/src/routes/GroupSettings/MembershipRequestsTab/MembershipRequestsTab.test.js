import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { toast } from 'sonner'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import userEvent from '@testing-library/user-event'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import MembershipRequestsTab from './MembershipRequestsTab'

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))

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

describe('MembershipRequestsTab: people blocked from rejoining', () => {
  const noRequests = graphql.query('FetchJoinRequests', () =>
    HttpResponse.json({ data: { joinRequests: { total: 0, hasMore: false, items: [] } } }))

  it('lists them for stewards and lifts a block', async () => {
    const user = userEvent.setup()
    let lifted
    mockGraphqlServer.use(
      noRequests,
      graphql.query('BlockedFromRejoining', () => HttpResponse.json({
        data: {
          group: {
            id: group.id,
            blockedFromRejoining: [
              { id: '1', createdAt: '2026-09-01T00:00:00.000Z', person: { id: '4', name: 'Removed Person', avatarUrl: null }, createdBy: { id: '10', name: 'Steward' } }
            ]
          }
        }
      })),
      graphql.mutation('LiftGroupBan', ({ variables }) => {
        lifted = variables
        return HttpResponse.json({ data: { liftGroupBan: { success: true } } })
      })
    )

    render(<MembershipRequestsTab group={group} />, null, providers())

    expect(await screen.findByText('Removed Person')).toBeInTheDocument()
    expect(screen.getByText('Blocked from rejoining')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lift block' }))

    await waitFor(() => expect(lifted).toEqual({ personId: '4', groupId: group.id }))
    await waitFor(() => expect(screen.queryByText('Removed Person')).not.toBeInTheDocument())
    expect(screen.queryByTestId('blocked-from-rejoining')).not.toBeInTheDocument()
  })

  it('shows nothing when nobody is blocked, as for people who are not stewards', async () => {
    mockGraphqlServer.use(
      noRequests,
      graphql.query('BlockedFromRejoining', () => HttpResponse.json({ data: { group: { id: group.id, blockedFromRejoining: [] } } }))
    )

    render(<MembershipRequestsTab group={group} />, null, providers())

    expect(await screen.findByText('No new join requests')).toBeInTheDocument()
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.queryByTestId('blocked-from-rejoining')).not.toBeInTheDocument()
  })
})

describe('MembershipRequestsTab: accepting a request fails', () => {
  it('puts the request back and says the person has to be unblocked first', async () => {
    const user = userEvent.setup()
    toast.error.mockClear()
    mockGraphqlServer.use(
      graphql.query('FetchJoinRequests', () => HttpResponse.json({
        data: { joinRequests: { total: 1, hasMore: false, items: [joinRequest('8', { id: '4', name: 'Removed Person' }, null)] } }
      })),
      graphql.query('BlockedFromRejoining', () => HttpResponse.json({ data: { group: { id: group.id, blockedFromRejoining: [] } } })),
      graphql.operation(({ query }) => {
        if (!query.includes('acceptJoinRequest(')) return
        return HttpResponse.json({
          errors: [{ message: 'This person is blocked from rejoining this group. Lift the block first.' }]
        })
      })
    )

    render(<MembershipRequestsTab group={group} />, null, providers())

    await user.click(await screen.findByRole('button', { name: 'Welcome' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('This person is blocked from rejoining this group. Lift the block first.'))
    expect(await screen.findByText('Removed Person')).toBeInTheDocument()
  })
})
