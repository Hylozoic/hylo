import React from 'react'
import { render, screen, fireEvent, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import BlockedUsersTab, { UnBlockUserControl } from './BlockedUsersTab'

describe('BlockedUsersTab', () => {
  it('renders a list of UnBlockUserControls', () => {
    const blockedUsers = [
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' },
      { id: 3, name: 'User 3' },
      { id: 4, name: 'User 4' }
    ]
    render(<BlockedUsersTab blockedUsers={blockedUsers} />)

    blockedUsers.forEach(user => {
      expect(screen.getByText(user.name)).toBeInTheDocument()
    })

    expect(screen.getAllByText('Unblock')).toHaveLength(4)
  })

  it('shows loading state when loading', () => {
    render(<BlockedUsersTab loading />)
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })
})

describe('UnBlockUserControl', () => {
  it('renders correctly and handles unblock action', () => {
    const blockedUser = {
      id: 'test-user-id',
      name: 'Test User'
    }
    const unBlockUser = jest.fn()

    render(
      <UnBlockUserControl blockedUser={blockedUser} unBlockUser={unBlockUser} />
    )

    expect(screen.getByText('Test User')).toBeInTheDocument()
    const unblockButton = screen.getByText('Unblock')
    expect(unblockButton).toBeInTheDocument()

    fireEvent.click(unblockButton)
    expect(unBlockUser).toHaveBeenCalledWith('test-user-id')
  })
})
