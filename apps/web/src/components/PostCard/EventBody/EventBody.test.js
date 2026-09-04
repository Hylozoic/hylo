import React from 'react'
import { DateTimeHelpers } from '@hylo/shared'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import EventBody from './EventBody'

describe('EventBody', () => {
  it('renders event details correctly', () => {
    const startTime = '2023-03-06T12:00:00.000Z'
    const endTime = '2023-03-06T15:00:00.000Z'
    const timezone = 'UTC'
    const event = {
      id: '1',
      location: 'Oakland',
      title: 'Test Event',
      startTime,
      endTime,
      timezone,
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

    expect(screen.getByText('Test Event')).toBeInTheDocument()
    expect(screen.getByText(DateTimeHelpers.formatEventTimeDisplay({
      start: startTime,
      end: endTime,
      eventTimezone: timezone
    }).primary)).toBeInTheDocument()
    expect(screen.getByText(/Oakland/)).toBeInTheDocument()
  })
})
