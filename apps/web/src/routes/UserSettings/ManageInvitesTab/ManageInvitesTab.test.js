import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import { JOIN_REQUEST_STATUS } from 'store/models/JoinRequest'
import ManageInvitesTab from './ManageInvitesTab'

describe('ManageInvitesTab', () => {
  it('renders a list of pending join requests', () => {
    const props = {
      canceledJoinRequests: [],
      pendingGroupInvites: [
        { id: '1', group: { id: 1, name: 'group1', avatarUrl: null }, creator: { id: 1, name: 'Testy Tester' } }
      ],
      pendingJoinRequests: [
        { id: '1', group: { id: 1, name: 'group1', avatarUrl: null } },
        { id: '2', group: { id: 2, name: 'group2', avatarUrl: null } }
      ],
      rejectedJoinRequests: [],
      cancelJoinRequest: jest.fn(),
      fetchMyInvitesAndRequests: jest.fn(() => Promise.resolve({ me: {} }))
    }

    render(<ManageInvitesTab {...props} />)

    expect(screen.getByText('Group Invitations & Join Requests')).toBeInTheDocument()
    expect(screen.getByText('Invitations to Join New Groups')).toBeInTheDocument()
    expect(screen.getByText('Your Open Requests to Join Groups')).toBeInTheDocument()
    expect(screen.getAllByText(/group\d/).length).toBe(3) // 2 pending join requests + 1 pending invite
    expect(screen.getByText('Testy Tester')).toBeInTheDocument()
  })

  it('displays loading state when loading prop is true', () => {
    const props = {
      loading: true,
      canceledJoinRequests: [],
      pendingGroupInvites: [],
      pendingJoinRequests: [],
      rejectedJoinRequests: [],
      cancelJoinRequest: jest.fn(),
      fetchMyInvitesAndRequests: jest.fn()
    }

    render(<ManageInvitesTab {...props} />)

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('renders declined invitations and requests', () => {
    const props = {
      canceledJoinRequests: [
        { id: '1', group: { id: 1, name: 'canceled1', avatarUrl: null }, status: JOIN_REQUEST_STATUS.Canceled }
      ],
      pendingGroupInvites: [],
      pendingJoinRequests: [],
      rejectedJoinRequests: [
        { id: '2', group: { id: 2, name: 'rejected1', avatarUrl: null }, status: JOIN_REQUEST_STATUS.Rejected }
      ],
      cancelJoinRequest: jest.fn(),
      fetchMyInvitesAndRequests: jest.fn(() => Promise.resolve({ me: {} }))
    }

    render(<ManageInvitesTab {...props} />)

    expect(screen.getByText('Declined Invitations & Requests')).toBeInTheDocument()
    expect(screen.getByText('canceled1')).toBeInTheDocument()
    expect(screen.getByText('rejected1')).toBeInTheDocument()
    expect(screen.getByText('Canceled')).toBeInTheDocument()
    expect(screen.getByText('Declined')).toBeInTheDocument()
  })
})
