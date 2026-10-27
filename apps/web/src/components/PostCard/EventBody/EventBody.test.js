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
    const display = DateTimeHelpers.formatEventTimeDisplay({
      start: startTime,
      end: endTime,
      eventTimezone: timezone
    })
    const normalize = content => content.replace(/\s/g, ' ')
    const viewerTime = normalize(display.secondary || display.primary)
    const topLine = display.secondary ? `Your time: ${viewerTime}` : viewerTime
    expect(screen.getByText((content, element) => (
      element.tagName === 'SPAN' && normalize(content) === topLine
    ))).toBeInTheDocument()
    if (display.secondary) {
      expect(screen.getByText((content, element) => (
        element.tagName === 'SPAN' && normalize(content) === `Local time: ${normalize(display.primary)}`
      ))).toBeInTheDocument()
    }
    expect(screen.getByText(/Oakland/)).toBeInTheDocument()
  })

  it('omits the Your time label when the event timezone matches the viewer', () => {
    const startTime = '2023-03-06T12:00:00.000Z'
    const endTime = '2023-03-06T15:00:00.000Z'
    const timezone = DateTimeHelpers.getCurrentTimezone()
    const event = {
      id: '1',
      location: 'Oakland',
      title: 'Same Zone Event',
      startTime,
      endTime,
      timezone,
      groups: [{ id: '1', name: 'Group 1', slug: 'group1' }]
    }

    render(<EventBody event={event} slug='sluggo' expanded respondToEvent={jest.fn()} />)

    const display = DateTimeHelpers.formatEventTimeDisplay({
      start: startTime,
      end: endTime,
      eventTimezone: timezone
    })
    const normalize = content => content.replace(/\s/g, ' ')
    expect(display.secondary).toBeNull()
    expect(screen.getByText((content, element) => (
      element.tagName === 'SPAN' && normalize(content) === normalize(display.primary)
    ))).toBeInTheDocument()
    expect(screen.queryByText(/Your time:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Local time:/)).not.toBeInTheDocument()
  })

  it('shows only the viewer time on the card', () => {
    const startTime = '2023-03-06T12:00:00.000Z'
    const endTime = '2023-03-06T15:00:00.000Z'
    const timezone = 'America/Los_Angeles'
    const event = {
      id: '1',
      location: 'Oakland',
      title: 'Test Event',
      startTime,
      endTime,
      timezone,
      groups: [{ id: '1', name: 'Group 1', slug: 'group1' }]
    }

    render(<EventBody event={event} slug='sluggo' expanded={false} respondToEvent={jest.fn()} />)

    const display = DateTimeHelpers.formatEventTimeDisplay({
      start: startTime,
      end: endTime,
      eventTimezone: timezone
    })
    const normalize = content => content.replace(/\s/g, ' ')
    const viewerTime = normalize(display.secondary || display.primary)
    expect(screen.getByText((content, element) => (
      element.tagName === 'SPAN' && normalize(content) === viewerTime
    ))).toBeInTheDocument()
    expect(screen.queryByText(/Your time:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Local time:/)).not.toBeInTheDocument()
  })
})
