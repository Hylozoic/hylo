import React from 'react'
import userEvent from '@testing-library/user-event'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import FinishRegistration from './FinishRegistration'

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))

afterEach(() => {
  trackAnalyticsEvent.mockClear()
})

function currentUserProvider () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  const reduxState = { orm: ormSession.state }

  extractModelsForTest({
    me: {
      id: '1',
      hasRegistered: false,
      emailValidated: true,
      settings: {
        signupInProgress: true
      }
    }
  }, 'Me', ormSession)

  return AllTheProviders(reduxState)
}

it('renders correctly', () => {
  render(
    <FinishRegistration />,
    { wrapper: currentUserProvider() }
  )

  expect(screen.getByText('One more step!')).toBeVisible()
})

it('renders password error if it not confirmed', async () => {
  const user = userEvent.setup()

  render(
    <FinishRegistration />,
    { wrapper: currentUserProvider() }
  )

  await user.type(screen.getByLabelText('name'), 'Smiley Person')
  await user.type(screen.getByLabelText('password'), '012345678')
  await user.type(screen.getByLabelText('passwordConfirmation'), '012345671')
  await user.click(screen.getByText('Jump in to Hylo!'))

  expect(screen.getByText("Passwords don't match")).toBeVisible()
})

it('does not submit if name is not present, even if password is valid', async () => {
  const user = userEvent.setup()
  const registerCalled = jest.fn()

  mockGraphqlServer.use(
    graphql.mutation('Register', ({ query, variables }) => {
      registerCalled(variables)

      // this return is required, results are ignored
      return HttpResponse.json({
        data: {
          register: {
            id: '1'
          }
        }
      })
    })
  )

  render(
    <FinishRegistration />,
    { wrapper: currentUserProvider() }
  )

  await user.type(screen.getByLabelText('password'), '012345678')
  await user.type(screen.getByLabelText('passwordConfirmation'), '012345678')
  await user.click(screen.getByText('Jump in to Hylo!'))

  expect(registerCalled).not.toHaveBeenCalled()
})

it('registers user if a name and valid password provided', async () => {
  const user = userEvent.setup()
  const registerCalled = jest.fn()

  mockGraphqlServer.use(
    graphql.mutation('Register', ({ query, variables }) => {
      registerCalled(variables)

      // this return is required, results are ignored
      return HttpResponse.json({
        data: {
          register: {
            id: '1'
          }
        }
      })
    })
  )

  render(
    <FinishRegistration />,
    { wrapper: currentUserProvider() }
  )

  await user.type(screen.getByLabelText('name'), 'Smiley Person')
  await user.type(screen.getByLabelText('password'), '012345678')
  await user.type(screen.getByLabelText('passwordConfirmation'), '012345678')
  await user.click(screen.getByText('Jump in to Hylo!'))

  expect(registerCalled).toHaveBeenCalledWith({ name: 'Smiley Person', password: '012345678' })
})

it('keeps submit disabled for a whitespace-only name', async () => {
  const user = userEvent.setup()
  const registerCalled = jest.fn()

  mockGraphqlServer.use(
    graphql.mutation('Register', ({ variables }) => {
      registerCalled(variables)
      return HttpResponse.json({ data: { register: { error: 'Name must not consist solely of whitespace.' } } })
    })
  )

  render(
    <FinishRegistration />,
    { wrapper: currentUserProvider() }
  )

  await user.type(screen.getByLabelText('name'), '   ')
  await user.type(screen.getByLabelText('password'), '012345678')
  await user.type(screen.getByLabelText('passwordConfirmation'), '012345678{Enter}')

  expect(screen.getByText('Jump in to Hylo!')).toBeDisabled()
  expect(registerCalled).not.toHaveBeenCalled()
})

it('trims the name before registering', async () => {
  const user = userEvent.setup()
  const registerCalled = jest.fn()

  mockGraphqlServer.use(
    graphql.mutation('Register', ({ variables }) => {
      registerCalled(variables)
      return HttpResponse.json({ data: { register: { me: null, error: null } } })
    })
  )

  render(
    <FinishRegistration />,
    { wrapper: currentUserProvider() }
  )

  await user.type(screen.getByLabelText('name'), '  Smiley Person  ')
  await user.type(screen.getByLabelText('password'), '012345678')
  await user.type(screen.getByLabelText('passwordConfirmation'), '012345678')
  await user.click(screen.getByText('Jump in to Hylo!'))

  await waitFor(() => {
    expect(registerCalled).toHaveBeenCalledWith({ name: 'Smiley Person', password: '012345678' })
  })
})

it('shows the error returned by the server and does not track Registered', async () => {
  const user = userEvent.setup()

  mockGraphqlServer.use(
    graphql.mutation('Register', () => {
      return HttpResponse.json({ data: { register: { me: null, error: 'Password must not consist solely of whitespace.' } } })
    })
  )

  render(
    <FinishRegistration />,
    { wrapper: currentUserProvider() }
  )

  await user.type(screen.getByLabelText('name'), 'Smiley Person')
  await user.type(screen.getByLabelText('password'), '         ')
  await user.type(screen.getByLabelText('passwordConfirmation'), '         ')
  await user.click(screen.getByText('Jump in to Hylo!'))

  expect(await screen.findByText('Password must not consist solely of whitespace.')).toBeVisible()
  expect(trackAnalyticsEvent).not.toHaveBeenCalled()
})

it('tracks Registered once the server returns the registered user', async () => {
  const user = userEvent.setup()

  mockGraphqlServer.use(
    graphql.mutation('Register', () => {
      return HttpResponse.json({
        data: {
          register: {
            me: {
              id: '1',
              email: 'smiley@hylo.com',
              emailValidated: true,
              hasRegistered: true,
              name: 'Smiley Person',
              settings: { signupInProgress: true }
            },
            error: null
          }
        }
      })
    })
  )

  render(
    <FinishRegistration />,
    { wrapper: currentUserProvider() }
  )

  await user.type(screen.getByLabelText('name'), 'Smiley Person')
  await user.type(screen.getByLabelText('password'), '012345678')
  await user.type(screen.getByLabelText('passwordConfirmation'), '012345678')
  await user.click(screen.getByText('Jump in to Hylo!'))

  await waitFor(() => {
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Registered')
  })
})
