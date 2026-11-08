import React from 'react'
import userEvent from '@testing-library/user-event'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import VerifyEmail from './VerifyEmail'
import { useLocation } from 'react-router-dom'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn()
}))

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))

function mockVerifyEmailResponse (verifyEmail) {
  mockGraphqlServer.use(
    graphql.operation(({ query }) => {
      if (!query.includes('verifyEmail')) return HttpResponse.json({ data: {} })
      return HttpResponse.json({ data: { verifyEmail } })
    })
  )
}

beforeEach(() => {
  useLocation.mockReturnValue({ search: '?email=test@hylo.com' })
})

afterEach(() => {
  trackAnalyticsEvent.mockClear()
})

it('renders correctly', async () => {
  render(
    <VerifyEmail />
  )

  expect(screen.getByText("We've sent a 6 digit code", { exact: false })).toBeInTheDocument()
})

it('tracks Email Verification Failed with the reason when the code is wrong', async () => {
  const user = userEvent.setup()
  mockVerifyEmailResponse({ me: null, error: 'invalid-code' })

  render(
    <VerifyEmail />
  )

  await user.type(screen.getByLabelText('verification input'), '123456')

  expect(await screen.findByText('Invalid code, please try again')).toBeInTheDocument()
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Email Verification Failed', { reason: 'invalid-code' })
  expect(trackAnalyticsEvent).not.toHaveBeenCalledWith('Email Verified')
})

it('tracks Email Verification Failed with the reason when the link has expired', async () => {
  useLocation.mockReturnValue({ search: '?email=test@hylo.com&token=expired-token' })
  mockVerifyEmailResponse({ me: null, error: 'invalid-link' })

  render(
    <VerifyEmail />
  )

  await waitFor(() => {
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Email Verification Failed', { reason: 'invalid-link' })
  })
})

it('does not send an unexpected server message as the failure reason', async () => {
  const user = userEvent.setup()
  mockVerifyEmailResponse({ me: null, error: 'Something unexpected' })

  render(
    <VerifyEmail />
  )

  await user.type(screen.getByLabelText('verification input'), '123456')

  await waitFor(() => {
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Email Verification Failed', { reason: 'other' })
  })
})

it('tracks Email Verified when the code is accepted', async () => {
  const user = userEvent.setup()
  mockVerifyEmailResponse({
    me: {
      id: '1',
      email: 'test@hylo.com',
      emailValidated: true,
      hasRegistered: false,
      name: null,
      settings: { signupInProgress: true }
    },
    error: null
  })

  render(
    <VerifyEmail />
  )

  await user.type(screen.getByLabelText('verification input'), '123456')

  await waitFor(() => {
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Email Verified')
  })
  expect(trackAnalyticsEvent).not.toHaveBeenCalledWith('Email Verification Failed', expect.anything())
})
