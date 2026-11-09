import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import AccountSettingsTab, { emailChangeErrorMessage } from './AccountSettingsTab'

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

  it('shows a pending email change while the current email stays in the field', () => {
    render(
      <AccountSettingsTab
        currentUser={{ email: 'old@example.com', pendingEmail: 'new@example.com' }}
        updateUserSettings={jest.fn()}
        setConfirm={jest.fn()}
      />
    )

    expect(screen.getByLabelText('Email')).toHaveValue('old@example.com')
    expect(screen.getByText('Confirm your new email address')).toBeInTheDocument()
    expect(screen.getByText(/new@example\.com/)).toBeInTheDocument()
    expect(screen.getByText('Cancel email change')).toBeInTheDocument()
  })

  it('shows no pending email change when there is none', () => {
    render(
      <AccountSettingsTab
        currentUser={{ email: 'old@example.com' }}
        updateUserSettings={jest.fn()}
        setConfirm={jest.fn()}
      />
    )

    expect(screen.queryByText('Confirm your new email address')).not.toBeInTheDocument()
  })

  it('does not send a changed email through updateUserSettings', async () => {
    const updateUserSettings = jest.fn()
    render(
      <AccountSettingsTab
        currentUser={{ email: 'old@example.com' }}
        updateUserSettings={updateUserSettings}
        setConfirm={jest.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => expect(screen.getByText('Save Changes')).toBeInTheDocument())
    expect(updateUserSettings).not.toHaveBeenCalled()
  })
})

describe('emailChangeErrorMessage', () => {
  const t = str => str

  it('maps backend errors to messages', () => {
    expect(emailChangeErrorMessage('duplicate-email', t)).toEqual('That email address is already in use')
    expect(emailChangeErrorMessage('invalid-code', t)).toEqual('Invalid code, please try again')
    expect(emailChangeErrorMessage('Too many attempts. Please wait a few minutes and try again.', t))
      .toEqual('Too many attempts. Please wait a few minutes and try again.')
    expect(emailChangeErrorMessage('something else', t)).toEqual('Something went wrong. Please try again.')
  })
})
