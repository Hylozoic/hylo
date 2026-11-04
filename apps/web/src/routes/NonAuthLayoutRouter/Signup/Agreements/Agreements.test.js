import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import Agreements from './Agreements'

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))

afterEach(() => {
  trackAnalyticsEvent.mockClear()
})

it('does not track acceptance until the agreements are checked', async () => {
  const user = userEvent.setup()

  render(<Agreements />)

  await user.click(screen.getByText('Continue'))

  expect(trackAnalyticsEvent).not.toHaveBeenCalled()
})

it('tracks Signup Agreements Accepted when the agreements are accepted', async () => {
  const user = userEvent.setup()

  render(<Agreements />)

  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByText('Continue'))

  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Signup Agreements Accepted')
})
