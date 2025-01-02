import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import AccountSettingsTab from './AccountSettingsTab'

describe('AccountSettingsTab', () => {
  it('renders correctly', () => {
    const mockUpdateUserSettings = jest.fn()
    const mockCurrentUser = { email: 'test@example.com' }
    const mockSetConfirm = jest.fn()

    render(
      <AccountSettingsTab
        currentUser={mockCurrentUser}
        updateUserSettings={mockUpdateUserSettings}
        setConfirm={mockSetConfirm}
      />
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
  it('displays error message for invalid email', async () => {
    render(
      <AccountSettingsTab
        currentUser={{ email: 'invalid-email' }}
        updateUserSettings={jest.fn()}
        setConfirm={jest.fn()}
      />
    )

    const emailInput = screen.getByLabelText('Email')
    fireEvent.change(emailInput, { target: { value: 'invalid-email1' } })
    emailInput.focus()
    emailInput.blur()

    await waitFor(() => {
      expect(screen.getByText('Email address is not in a valid format')).toBeInTheDocument()
    })
  })

  // Test for password mismatch
  it('displays error message when passwords do not match', () => {
    render(
      <AccountSettingsTab
        currentUser={{ email: 'test@example.com' }}
        updateUserSettings={jest.fn()}
        setConfirm={jest.fn()}
      />
    )

    const newPasswordInput = screen.getByLabelText('New Password')
    const confirmPasswordInput = screen.getByLabelText('New Password (Confirm)')

    fireEvent.change(newPasswordInput, { target: { value: 'Password123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'Password456' } })

    newPasswordInput.focus()
    newPasswordInput.blur()
    confirmPasswordInput.focus()
    confirmPasswordInput.blur()

    expect(screen.getByText('Passwords don\'t match')).toBeInTheDocument()
  })
})
