import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { render, screen, fireEvent, waitFor, within } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
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

  describe('the groups you are the only Administrator of', () => {
    const soleGroups = [
      { id: '5', name: 'Seed Library', slug: 'seed-library', avatarUrl: null },
      { id: '6', name: 'Tool Share', slug: 'tool-share', avatarUrl: null }
    ]

    beforeEach(() => {
      mockGraphqlServer.use(
        graphql.query('MySoleAdministratorGroups', () => HttpResponse.json({ data: { mySoleAdministratorGroups: soleGroups } }))
      )
    })

    it('lists them in the deactivate dialog, with a way to choose someone to take over, without blocking', async () => {
      const deactivateMe = jest.fn(() => Promise.resolve())
      render(
        <AccountSettingsTab currentUser={{ id: '1', email: 'test@example.com' }} updateUserSettings={jest.fn()} setConfirm={jest.fn()} deactivateMe={deactivateMe} logout={jest.fn()} />
      )

      fireEvent.click(screen.getByText('Deactivate Account'))
      const warning = await screen.findByTestId('sole-administrator-warning')
      expect(within(warning).getByText("You're the only Administrator of these groups")).toBeInTheDocument()
      expect(within(warning).getByText('Seed Library')).toBeInTheDocument()
      expect(within(warning).getByText('Tool Share')).toBeInTheDocument()
      expect(within(warning).getAllByRole('link', { name: 'Choose a new Administrator' })[0])
        .toHaveAttribute('href', '/groups/seed-library/settings/roles')

      fireEvent.click(screen.getByText('Deactivate my account'))
      expect(deactivateMe).toHaveBeenCalled()
    })

    it('lists them in the delete dialog too', async () => {
      render(
        <AccountSettingsTab currentUser={{ id: '1', email: 'test@example.com' }} updateUserSettings={jest.fn()} setConfirm={jest.fn()} deleteMe={jest.fn(() => Promise.resolve())} logout={jest.fn()} />
      )

      fireEvent.click(screen.getByText('Delete Account'))
      const warning = await screen.findByTestId('sole-administrator-warning')
      expect(within(warning).getByText('Seed Library')).toBeInTheDocument()
    })

    it('shows nothing when there are none', async () => {
      mockGraphqlServer.use(
        graphql.query('MySoleAdministratorGroups', () => HttpResponse.json({ data: { mySoleAdministratorGroups: [] } }))
      )
      render(
        <AccountSettingsTab currentUser={{ id: '1', email: 'test@example.com' }} updateUserSettings={jest.fn()} setConfirm={jest.fn()} />
      )

      fireEvent.click(screen.getByText('Delete Account'))
      await screen.findByText('Delete my account')
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(screen.queryByTestId('sole-administrator-warning')).not.toBeInTheDocument()
    })
  })

  describe('why someone is leaving', () => {
    beforeEach(() => {
      mockGraphqlServer.use(
        graphql.query('MySoleAdministratorGroups', () => HttpResponse.json({ data: { mySoleAdministratorGroups: [] } }))
      )
    })

    it('asks one optional question, points "too many emails" to notification settings, and sends the answer', async () => {
      const deactivateMe = jest.fn(() => Promise.resolve())
      render(
        <AccountSettingsTab currentUser={{ id: '1', email: 'test@example.com' }} updateUserSettings={jest.fn()} setConfirm={jest.fn()} deactivateMe={deactivateMe} logout={jest.fn()} />
      )

      fireEvent.click(screen.getByText('Deactivate Account'))
      const question = await screen.findByTestId('exit-reason')
      expect(within(question).getByText('Why are you leaving? (optional)')).toBeInTheDocument()
      expect(screen.queryByTestId('exit-reason-emails')).not.toBeInTheDocument()

      fireEvent.click(within(question).getByLabelText('I get too many emails'))
      expect(within(question).getByRole('link', { name: 'Change your notification settings' })).toHaveAttribute('href', '/my/notifications')

      fireEvent.click(screen.getByText('Deactivate my account'))
      expect(deactivateMe).toHaveBeenCalledWith({ reason: 'too_many_emails' })
    })

    it('lets people delete without answering', async () => {
      const deleteMe = jest.fn(() => Promise.resolve())
      render(
        <AccountSettingsTab currentUser={{ id: '1', email: 'test@example.com' }} updateUserSettings={jest.fn()} setConfirm={jest.fn()} deleteMe={deleteMe} logout={jest.fn()} />
      )

      fireEvent.click(screen.getByText('Delete Account'))
      await screen.findByTestId('exit-reason')
      fireEvent.click(screen.getByText('Delete my account'))
      expect(deleteMe).toHaveBeenCalledWith({ reason: null })
    })
  })
})
