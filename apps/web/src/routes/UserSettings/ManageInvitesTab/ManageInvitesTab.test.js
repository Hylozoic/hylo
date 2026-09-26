import React from 'react'
import userEvent from '@testing-library/user-event'
import orm from 'store/models'
import { JOIN_REQUEST_STATUS } from 'store/models/JoinRequest'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import ManageInvitesTab from './ManageInvitesTab'
import { cancelJoinRequest } from './ManageInvitesTab.store'

jest.mock('./ManageInvitesTab.store', () => ({
  ...jest.requireActual('./ManageInvitesTab.store'),
  cancelJoinRequest: jest.fn(() => ({ type: 'MOCK_CANCEL_JOIN_REQUEST' })),
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

  it('cancels a join request with its group so the cancel can be tracked', async () => {
    const user = userEvent.setup()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create({ id: '5', name: 'Test Group', slug: 'test-group', type: 'group' })
    ormSession.JoinRequest.create({ id: '10', group: '5', status: JOIN_REQUEST_STATUS.Pending, createdAt: '2026-01-01T00:00:00.000Z' })
    ormSession.Me.create({ id: '1', name: 'Test User', joinRequests: ['10'] })

    render(<ManageInvitesTab />, { wrapper: AllTheProviders({ orm: ormSession.state }) })

    await user.click(await screen.findByText('Cancel Request'))

    expect(cancelJoinRequest).toHaveBeenCalledWith('10', '5')
    confirmSpy.mockRestore()
  })
})
