import React from 'react'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import NonAuthLayoutRouter from './NonAuthLayoutRouter'

jest.mock('routes/JoinGroup', () => () => <div>JoinGroup route</div>)

// Currently the test below is going to default route to `/login`
// so until more tests are added this test is identical to the `Login`
// component test

it('renders correctly', () => {
  render(
    <NonAuthLayoutRouter location={{ search: '' }} />
  )

  expect(screen.getByText('Sign in to Hylo')).toBeInTheDocument()
})

it.each([
  '/h/use-invitation?token=steward-token',
  '/h/invitation?token=member-token',
  '/groups/garden/join/join-code'
])('opens invitation links at %s with JoinGroup', async (path) => {
  render(
    <NonAuthLayoutRouter location={{ search: '' }} />,
    { wrapper: AllTheProviders({}, [path]) }
  )

  expect(await screen.findByText('JoinGroup route')).toBeInTheDocument()
  expect(screen.queryByText('Sign in to Hylo')).not.toBeInTheDocument()
})
