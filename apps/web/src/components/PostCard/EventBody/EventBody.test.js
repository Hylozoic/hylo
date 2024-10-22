import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import EventBody from './EventBody'
import moment from 'moment-timezone'

describe('EventBody', () => {
  it('renders event details correctly', () => {
    const event = {
      startTime: moment('2023-03-06T12:00:00Z'),
      endTime: moment('2023-03-06T15:00:00Z'),
      location: 'Oakland',
      title: 'Test Event'
    }

    const props = {
      event,
      slug: 'sluggo',
      expanded: true,
      className: 'external-class',
      respondToEvent: jest.fn()
    }

    render(<EventBody {...props} />)

    // Check for event title
    expect(screen.getByText('Test Event')).toBeInTheDocument()

    // Check for event time
    expect(screen.getByText(/12:00 PM - 3:00 PM/)).toBeInTheDocument()

    // Check for event location
    expect(screen.getByText('Oakland')).toBeInTheDocument()

    // Check for RSVP button
    expect(screen.getByText('RSVP')).toBeInTheDocument()

    // Check for Invite button
    expect(screen.getByText('Invite')).toBeInTheDocument()
  })

  // Add more tests as needed
})
