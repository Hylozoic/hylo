import React from 'react'
import orm from 'store/models'
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
