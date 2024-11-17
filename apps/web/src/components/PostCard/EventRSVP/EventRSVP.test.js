import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import EventRSVP from './EventRSVP'
import { RESPONSES } from 'store/models/EventInvitation'

describe('EventRSVP', () => {
  const mockRespondToEvent = jest.fn()

  it('renders correctly with YES response', () => {
    render(<EventRSVP myEventResponse={RESPONSES.YES} respondToEvent={mockRespondToEvent} />)
    expect(screen.getByText('Going')).toBeInTheDocument()
  })

  it('renders correctly with INTERESTED response', () => {
    render(<EventRSVP myEventResponse={RESPONSES.INTERESTED} respondToEvent={mockRespondToEvent} />)
    expect(screen.getByText('Interested')).toBeInTheDocument()
  })

  it('renders correctly with NO response', () => {
    render(<EventRSVP myEventResponse={RESPONSES.NO} respondToEvent={mockRespondToEvent} />)
    expect(screen.getByText('Not Going')).toBeInTheDocument()
  })

  it('renders correctly with no response', () => {
    render(<EventRSVP respondToEvent={mockRespondToEvent} />)
    expect(screen.getByText('RSVP')).toBeInTheDocument()
  })

  // Additional test to check if the dropdown opens and selections work
  it('opens dropdown and allows response selection', () => {
    render(<EventRSVP respondToEvent={mockRespondToEvent} />)

    // Click the RSVP button to open dropdown
    const rsvpButton = screen.getByText('RSVP')
    rsvpButton.click()

    // Check if all options are present
    expect(screen.getByText('Going')).toBeInTheDocument()
    expect(screen.getByText('Interested')).toBeInTheDocument()
    expect(screen.getByText('Not Going')).toBeInTheDocument()

    // Click an option and verify respondToEvent was called
    const goingOption = screen.getByText('Going')
    goingOption.click()
    expect(mockRespondToEvent).toHaveBeenCalledWith(RESPONSES.YES)
  })

  it('passes position prop to DropdownButton', () => {
    const position = 'bottom-right'
    render(<EventRSVP respondToEvent={mockRespondToEvent} position={position} />)

    const dropdownButton = screen.getByText('RSVP')
    expect(dropdownButton.closest('[data-position]')).toHaveAttribute('data-position', position)
  })
})
