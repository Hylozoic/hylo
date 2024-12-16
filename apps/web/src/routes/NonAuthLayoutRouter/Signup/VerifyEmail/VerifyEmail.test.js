import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import VerifyEmail from './VerifyEmail'
import { useLocation } from 'react-router-dom'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({ search: '?email=test@hylo.com' })
}))

it('renders correctly', async () => {
  render(
    <VerifyEmail />
  )

  expect(screen.getByText("We've sent a 6 digit code", { exact: false })).toBeInTheDocument()
})
