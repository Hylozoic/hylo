import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import EventBody from './EventBody'

describe('EventBody', () => {
  it('renders event details correctly', () => {
    const event = {
      location: 'Oakland',
      title: 'Test Event',
      groups: [{ id: '1', name: 'Group 1', slug: 'group1' }]
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
    expect(screen.getByText(/Mon, Mar 6, 2023 at 12:00PM - Mon, Mar 6 at 3:00PM GMT/)).toBeInTheDocument()

    // Check for event location
    expect(screen.getAllByText(/Oakland/)).toHaveLength(2)
  })

  // Add more tests as needed
})
