import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import AccountSettingsTab from './AccountSettingsTab'

describe('AccountSettingsTab', () => {
  it('renders correctly', () => {
    const mockUpdateUserSettings = jest.fn()
    const mockCurrentUser = { email: 'test@example.com' }

    render(
      <AccountSettingsTab
        currentUser={mockCurrentUser}
        updateUserSettings={mockUpdateUserSettings}
      />,
      {
        wrapper: AllTheProviders,
        reduxState: {
          // Add any necessary initial Redux state here
        }
      }
    )

    // Check for the presence of key elements
    expect(screen.getByText('Update Account')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.com')
    expect(screen.getByLabelText('New Password')).toBeInTheDocument()
    expect(screen.getByLabelText('New Password (Confirm)')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
    expect(screen.getByText('Deactivate Account')).toBeInTheDocument()
    expect(screen.getByText('Delete Account')).toBeInTheDocument()
  })

  // Add more tests as needed, for example:
  it('displays error message for invalid email', () => {
    render(
      <AccountSettingsTab
        currentUser={{ email: 'invalid-email' }}
        updateUserSettings={jest.fn()}
      />,
      { wrapper: AllTheProviders }
    )

    const emailInput = screen.getByLabelText('Email')
    emailInput.focus()
    emailInput.blur()

    expect(screen.getByText('Email address is not in a valid format')).toBeInTheDocument()
  })

  // Test for password mismatch
  it('displays error message when passwords do not match', () => {
    render(
      <AccountSettingsTab
        currentUser={{ email: 'test@example.com' }}
        updateUserSettings={jest.fn()}
      />,
      { wrapper: AllTheProviders }
    )

    const newPasswordInput = screen.getByLabelText('New Password')
    const confirmPasswordInput = screen.getByLabelText('New Password (Confirm)')

    newPasswordInput.value = 'password123'
    confirmPasswordInput.value = 'password456'

    newPasswordInput.focus()
    newPasswordInput.blur()
    confirmPasswordInput.focus()
    confirmPasswordInput.blur()

    expect(screen.getByText('Passwords don\'t match')).toBeInTheDocument()
  })
})
