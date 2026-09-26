import React from 'react'
import userEvent from '@testing-library/user-event'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import ManageInvitesTab from './ManageInvitesTab'

jest.mock('./ManageInvitesTab.store', () => ({
  ...jest.requireActual('./ManageInvitesTab.store'),
  fetchMyInvitesAndRequests: () => ({ type: 'MOCK_FETCH_MY_REQUESTS_AND_INVITES' })
}))

function emptyProviders (pending = {}) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1', name: 'Test User' })
  return AllTheProviders({ orm: ormSession.state, pending })
}

describe('ManageInvitesTab', () => {
  it('renders empty invite and request sections', async () => {
    render(<ManageInvitesTab />, { wrapper: emptyProviders() })

    await waitFor(() => {
      expect(screen.getByText('Invitations to Join New Groups')).toBeInTheDocument()
      expect(screen.getByText('Invitations to Join Spaces')).toBeInTheDocument()
      expect(screen.getByText('Your Open Requests to Join Groups')).toBeInTheDocument()
      expect(screen.getByText('Your Open Requests to Join Spaces')).toBeInTheDocument()
      expect(screen.getByText('Declined Invitations & Requests')).toBeInTheDocument()
    })
  })

  it('displays loading state when fetch is pending', () => {
    render(
      <ManageInvitesTab />,
      { wrapper: emptyProviders({ FETCH_MY_REQUESTS_AND_INVITES: true }) }
    )

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })
})

describe('ManageInvitesTab accepting an invitation', () => {
  function providersWithInvite () {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Person.create({ id: '7', name: 'Ada Member' })
    ormSession.Group.create({ id: '3', name: 'Garden Club', slug: 'garden' })
    ormSession.Invitation.create({ id: '20', token: 'invite-token', group: '3', creator: '7', createdAt: '2026-09-20T00:00:00.000Z' })
    ormSession.Me.create({ id: '1', name: 'Test User', groupInvitesPending: ['20'] })
    return AllTheProviders({ orm: ormSession.state, pending: {} })
  }

  function mockUseInvitation (useInvitation) {
    mockGraphqlServer.use(
      graphql.mutation('UseInvitation', () => HttpResponse.json({ data: { useInvitation } }))
    )
  }

  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('opens the group page to request to join when a steward has to approve', async () => {
    const user = userEvent.setup()
    mockUseInvitation({ membership: null, error: null, requiresApproval: true, groupSlug: 'garden' })

    render(<ManageInvitesTab />, { wrapper: providersWithInvite() })

    await user.click(await screen.findByRole('button', { name: 'Join group' }))

    await waitFor(() => {
      expect(window.location.pathname + window.location.search).toBe('/groups/garden/about?token=invite-token')
    })
  })

  it('opens the group once the invitation has made the person a member', async () => {
    const user = userEvent.setup()
    mockUseInvitation({
      membership: { id: '30', group: { id: '3', slug: 'garden' }, person: { id: '1' } },
      error: null,
      requiresApproval: null,
      groupSlug: null
    })

    render(<ManageInvitesTab />, { wrapper: providersWithInvite() })

    await user.click(await screen.findByRole('button', { name: 'Join group' }))

    await waitFor(() => {
      expect(window.location.pathname + window.location.search).toBe('/groups/garden')
    })
  })
})
