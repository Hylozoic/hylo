import React from 'react'
import { useLocation } from 'react-router-dom'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
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

function ShowLocation () {
  const location = useLocation()
  return <div data-testid='location'>{location.pathname + location.search}</div>
}

describe('with a return path in the address', () => {
  // The jest setup stubs useLocation; these tests need the router's real location
  beforeEach(() => {
    useLocation.mockImplementation(jest.requireActual('react-router-dom').useLocation)
  })

  afterEach(() => {
    useLocation.mockReturnValue({ pathname: '', search: '' })
  })

  it.each([
    ['/signup?returnToUrl=%2Fgroups%2Fgarden%2Fofferings%2F7', '/signup', 'Welcome to Hylo'],
    ['/login?returnToUrl=%2Fpost%2F9', '/login', 'Sign in to Hylo']
  ])('opens %s on its own page, without the return path in the address', async (path, page, heading) => {
    render(
      <>
        <NonAuthLayoutRouter />
        <ShowLocation />
      </>,
      { wrapper: AllTheProviders({}, [path]) }
    )

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(new RegExp(`^${page}$`)))
    expect(screen.getByText(heading)).toBeInTheDocument()
  })
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
