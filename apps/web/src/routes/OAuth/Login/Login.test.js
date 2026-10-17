import Login from './Login'
import { http, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import React from 'react'

it('renders correctly', () => {
  render(
    <Login location={{ search: '' }} match={{ params: { uid: 'uid' } }} />
  )

  expect(screen.getByText('Sign in to Hylo')).toBeInTheDocument()
})

it('shows an incorrect email or password error instead of crashing', async () => {
  const user = userEvent.setup()

  mockGraphqlServer.use(
    http.post('*/noo/oidc/*', () => new HttpResponse('Incorrect email or password', { status: 403 }))
  )

  render(
    <Login location={{ search: '' }} match={{ params: { uid: 'uid' } }} />
  )

  await user.type(screen.getByLabelText('email'), 'someone@hylo.com')
  await user.type(screen.getByLabelText('password'), 'wrong-password')
  await user.click(screen.getByText('Sign in'))

  expect(await screen.findByText('Incorrect email or password.', { exact: false })).toBeInTheDocument()
  expect(screen.getByText('Reset your password')).toBeInTheDocument()
})
