import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import EventBody from './EventBody'

// Mock the RESPONSES constant
jest.mock('@hylo/presenters/EventInvitationPresenter', () => ({
  ...jest.requireActual('@hylo/presenters/EventInvitationPresenter'),
  RESPONSES: {
    YES: 'yes',
    NO: 'no',
    INTERESTED: 'interested'
  }
}))

describe('EventBody', () => {
  const currentUser = { id: '1', name: 'Current User' }
  const attendees = [
    { ...currentUser, response: 'yes' },
    { id: '2', name: 'John Doe', response: 'yes' },
    { id: '3', name: 'Jane Smith', response: 'interested' }
  ]

  const mockEvent = {
    id: '123',
    location: 'Oakland',
    locationObject: {
      id: 'loc123',
      city: 'Oakland',
      region: 'CA',
      country: 'USA',
      fullText: 'Oakland, CA, USA'
    },
    title: 'Test Event',
    details: '<p>This is a test event description</p>',
    groups: [{ id: '1', name: 'Group 1', slug: 'group1' }],
    startTime: '2023-03-06T12:00:00Z',
    endTime: '2023-03-06T15:00:00Z',
    eventInvitations: attendees,
    attachments: [],
    type: 'event',
    myEventResponse: 'yes',
    clickthrough: false
  }

  const defaultProps = {
    event: mockEvent,
    slug: 'sluggo',
    expanded: true,
    className: 'external-class',
    respondToEvent: jest.fn(),
    onClick: jest.fn(),
    currentUser
  }

  it('renders event details correctly', () => {
    render(<EventBody {...defaultProps} />)

    // Check for event title
    expect(screen.getByText('Test Event')).toBeInTheDocument()

    // Check for event time
    expect(screen.getByText(/Mar 6, 2023 • 12:00 PM - 3:00 PM/)).toBeInTheDocument()
    expect(screen.getByText(/Event ended/)).toBeInTheDocument()
    
    // Check for event location
    expect(screen.getAllByText(/Oakland/)).toHaveLength(1)

    // Check for event description
    expect(screen.getByText('This is a test event description')).toBeInTheDocument()
  })

  it('renders event with no attendees correctly', () => {
    const eventWithNoAttendees = {
      ...mockEvent,
      eventInvitations: [],
      myEventResponse: null
    }
    
    render(<EventBody {...defaultProps} event={eventWithNoAttendees} />)
    
    expect(screen.getByText('No one attended')).toBeInTheDocument()
  })

  it('handles future events correctly', () => {
    const futureEvent = {
      ...mockEvent,
      startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endTime: new Date(Date.now() + 172800000).toISOString() // Day after tomorrow
    }
    
    render(<EventBody {...defaultProps} event={futureEvent} />)
    
    // Should not show 'Event ended' for future events
    expect(screen.queryByText(/Event ended/)).not.toBeInTheDocument()
  })

  it('renders event with attendees correctly', () => {
    const eventWithAttendees = {
      ...mockEvent,
      eventInvitations: attendees
    }
    
    render(<EventBody {...defaultProps} event={eventWithAttendees} />)
    
    // Should show attendance information
    expect(screen.getByText(/2/)).toBeInTheDocument() // Total attendees
  })

  it('handles flagged events correctly', () => {
    render(<EventBody {...defaultProps} event={mockEvent} isFlagged />)
    
    // Check if the flagged class is applied
    expect(screen.getByText('clickthroughExplainer')).toBeInTheDocument()
  })

  it('renders event with no location correctly', () => {
    const eventWithNoLocation = {
      ...mockEvent,
      location: null,
      locationObject: null
    }
    
    render(<EventBody {...defaultProps} event={eventWithNoLocation} />)
    
    // Should not show location icon or text
    expect(screen.queryByTestId('icon-Location')).not.toBeInTheDocument()
  })

  it('handles constrained view correctly', () => {
    render(<EventBody {...defaultProps} constrained={true} />)
    
    // Check if constrained classes are applied
    const postTitle = screen.getByTestId('post-title')
    expect(postTitle).toHaveClass('constrained')
  })

  it('handles event invitation dialog', () => {
    const futureEvent = {
      ...mockEvent,
      startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endTime: new Date(Date.now() + 172800000).toISOString() // Day after tomorrow
    }

    render(
      <EventBody 
        {...defaultProps}
        event={futureEvent}
        currentUser={currentUser}
      />
    )
    
    // Find and click the invite button
    const inviteButton = screen.getByText('Invite')
    fireEvent.click(inviteButton)
    
    expect(screen.getByTestId('popup-inner')).toBeInTheDocument()
  })

  it('handles togglePeopleDialog when clicking on attendees', () => {
    const togglePeopleDialog = jest.fn()
    const eventWithAttendees = {
      ...mockEvent,
      eventInvitations: attendees,
      startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endTime: new Date(Date.now() + 172800000).toISOString() // Day after tomorrow
    }

    render(
      <EventBody 
        {...defaultProps}
        event={eventWithAttendees}
        togglePeopleDialog={togglePeopleDialog}
      />
    )

    // Find and click the attendees section
    const peopleInfo = screen.getByText('You and John attending')
    fireEvent.click(peopleInfo)

    // Verify togglePeopleDialog was called
    expect(togglePeopleDialog).toHaveBeenCalled()
  })

  it('reports correctly when there are many attendees', () => {
    const togglePeopleDialog = jest.fn()
    const eventWithAttendees = {
      ...mockEvent,
      eventInvitations: attendees,
      startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endTime: new Date(Date.now() + 172800000).toISOString() // Day after tomorrow
    }

    eventWithAttendees.eventInvitations.push({ id: '6', name: 'Sandra Brown', response: 'yes' })
    eventWithAttendees.eventInvitations.push({ id: '5', name: 'Sam Smith', response: 'yes' })
    render(
      <EventBody 
        {...defaultProps}
        event={eventWithAttendees}
        togglePeopleDialog={togglePeopleDialog}
      />
    )

    // Find and click the attendees section
    const peopleInfo = screen.getByText('John, Sandra and 2 others attending')
    fireEvent.click(peopleInfo)

    // Verify togglePeopleDialog was called
    expect(togglePeopleDialog).toHaveBeenCalled()
  })
})
