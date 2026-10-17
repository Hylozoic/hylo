import React from 'react'
import { useLocation } from 'react-router-dom'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import Signup from './Signup'

afterEach(() => {
  useLocation.mockReturnValue({ pathname: '', search: '' })
})

it('renders correctly', () => {
  render(
    <Signup location={{ search: '' }} />
  )

  expect(screen.getByText('Enter your email to get started:')).toBeInTheDocument()
  expect(screen.getByText('Create account')).toBeDisabled()
})

it('prefills the invited email passed in router state and enables Create account', () => {
  useLocation.mockReturnValue({ pathname: '/signup', search: '', state: { email: 'invited@hylo.com' } })

  render(
    <Signup />
  )

  expect(screen.getByLabelText('email')).toHaveValue('invited@hylo.com')
  expect(screen.getByText('Create account')).toBeEnabled()
})

it('shows the invite error passed in the query string', () => {
  useLocation.mockReturnValue({ pathname: '/signup', search: '?error=invite-expired' })

  render(
    <Signup />
  )

  expect(screen.getByText('Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one.')).toBeInTheDocument()
})
