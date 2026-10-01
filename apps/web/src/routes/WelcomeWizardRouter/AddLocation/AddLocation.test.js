import React from 'react'
import userEvent from '@testing-library/user-event'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import AddLocation from './AddLocation'

jest.mock('components/ui/tooltip', () => ({ TooltipProvider: ({ children }) => children }))
jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))

afterEach(() => {
  trackAnalyticsEvent.mockClear()
})

describe('AddLocation', () => {
  it('renders the location input and instructions', () => {
    render(<AddLocation />)

    // Check for the step count
    expect(screen.getByText('STEP 2/3')).toBeInTheDocument()

    // Check for the location input
    expect(screen.getByPlaceholderText('Where do you call home?')).toBeInTheDocument()

    // Check for the instructions
    expect(screen.getByText('Add your location to see more relevant content, and find people and projects around you.')).toBeInTheDocument()

    // Check for the footer buttons
    expect(screen.getByText('Next: Welcome to Hylo!')).toBeInTheDocument()
  })

  it('tracks the step being viewed', () => {
    render(<AddLocation />)

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Welcome Wizard Step Viewed', { step: 'add-location' })
  })

  it('tracks the step as skipped when continuing without a location', async () => {
    const user = userEvent.setup()
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Me.create({ id: '1', name: 'Test User', settings: { signupInProgress: true } })
    render(<AddLocation />, { wrapper: AllTheProviders({ orm: ormSession.state }) })

    await user.click(screen.getByText('Next: Welcome to Hylo!'))

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Welcome Wizard Step Skipped', { step: 'add-location' })
  })
})
