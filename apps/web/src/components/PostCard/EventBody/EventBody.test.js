import React from 'react'
import { DateTimeHelpers } from '@hylo/shared'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import EventBody from './EventBody'

describe('EventBody', () => {
  it('renders event details correctly', () => {
    const startTime = '2023-03-06T12:00:00.000Z'
    const endTime = '2023-03-06T15:00:00.000Z'
    const event = {
      location: 'Oakland',
      title: 'Test Event',
      startTime,
      endTime,
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
    expect(screen.getByText(DateTimeHelpers.formatDatePair({ start: startTime, end: endTime }))).toBeInTheDocument()
    expect(screen.getByText(/Oakland/)).toBeInTheDocument()
  })
})

