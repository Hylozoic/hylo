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
  it('opens
