import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import GroupCalendarSubscribe from './GroupCalendarSubscribe'

jest.mock('components/ui/tooltip', () => ({ TooltipProvider: ({ children }) => children }))
jest.mock('components/ModalDialog', () => {
  const React = require('react')
  return function MockModalDialog ({ children, closeModal }) {
    return (
      <div data-testid='modal-dialog'>
        <button onClick={closeModal}>Close</button>
        {children}
      </div>
    )
  }
})

const GOOGLE_CALENDAR_ADD_URL = 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl'

describe('GroupCalendarSubscribe', () => {
  const defaultProps = {
    eventCalendarUrl: 'https://example.com/calendar/feed.ics'
  }

  beforeEach(() => {
    const writeTextMock = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    })
    jest.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    window.open.mockRestore()
  })

  it('renders Subscribe button with Rss icon when eventCalendarUrl is provided', () => {
    render(<GroupCalendarSubscribe {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Subscribe to this Group's Calendar/i })).toBeInTheDocument()
  })

  it('does not render Subscribe button when eventCalendarUrl is empty', () => {
    render(<GroupCalendarSubscribe eventCalendarUrl='' />)
    expect(screen.queryByRole('button', { name: /Subscribe to this Group's Calendar/i })).not.toBeInTheDocument()
  })

  it('does not render Subscribe button when eventCalendarUrl is undefined', () => {
    render(<GroupCalendarSubscribe />)
    expect(screen.queryByRole('button', { name: /Subscribe to this Group's Calendar/i })).not.toBeInTheDocument()
  })

  describe('when onEnsureCalendarUrl is provided (e.g. RSVP calendar without token yet)', () => {
    const rsvpLabel = 'Subscribe to all the Hylo events you have RSVPed to'

    it('renders button even when eventCalendarUrl is empty', () => {
      render(
        <GroupCalendarSubscribe
          eventCalendarUrl=''
          buttonLabel={rsvpLabel}
          modalTitle={rsvpLabel}
          onEnsureCalendarUrl={jest.fn().mockResolvedValue('https://example.com/user/cal.ics')}
        />
      )
      expect(screen.getByRole('button', { name: new RegExp(rsvpLabel, 'i') })).toBeInTheDocument()
    })

    it('calls onEnsureCalendarUrl when button is clicked and eventCalendarUrl is empty, then opens modal with returned URL', async () => {
      const resolvedUrl = 'https://example.com/user/99/calendar-token.ics'
      const onEnsureCalendarUrl = jest.fn().mockResolvedValue(resolvedUrl)
      render(
        <GroupCalendarSubscribe
          eventCalendarUrl=''
          buttonLabel={rsvpLabel}
          modalTitle={rsvpLabel}
          onEnsureCalendarUrl={onEnsureCalendarUrl}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: new RegExp(rsvpLabel, 'i') }))
      expect(onEnsureCalendarUrl).toHaveBeenCalledTimes(1)
      await waitFor(() => {
        expect(screen.getByText(resolvedUrl)).toBeInTheDocument()
      })
      expect(screen.getByText(rsvpLabel)).toBeInTheDocument()
    })

    it('does not open modal when onEnsureCalendarUrl rejects', async () => {
      const onEnsureCalendarUrl = jest.fn().mockRejectedValue(new Error('Failed'))
      render(
        <GroupCalendarSubscribe
          eventCalendarUrl=''
          buttonLabel={rsvpLabel}
          modalTitle={rsvpLabel}
          onEnsureCalendarUrl={onEnsureCalendarUrl}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: new RegExp(rsvpLabel, 'i') }))
      await waitFor(() => {
        expect(onEnsureCalendarUrl).toHaveBeenCalled()
      })
      expect(screen.queryByTestId('modal-dialog')).not.toBeInTheDocument()
    })

    it('does not open modal when onEnsureCalendarUrl resolves with empty string', async () => {
      const onEnsureCalendarUrl = jest.fn().mockResolvedValue('')
      render(
        <GroupCalendarSubscribe
          eventCalendarUrl=''
          buttonLabel={rsvpLabel}
          modalTitle={rsvpLabel}
          onEnsureCalendarUrl={onEnsureCalendarUrl}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: new RegExp(rsvpLabel, 'i') }))
      await waitFor(() => {
        expect(onEnsureCalendarUrl).toHaveBeenCalled()
      })
      expect(screen.queryByTestId('modal-dialog')).not.toBeInTheDocument()
    })
  })

  it('opens modal with calendar URL when Subscribe button is clicked', () => {
    render(<GroupCalendarSubscribe {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /Subscribe to this Group's Calendar/i }))
    expect(screen.getByText(defaultProps.eventCalendarUrl)).toBeInTheDocument()
  })

  it('modal has a Copy button that copies URL to clipboard', () => {
    render(<GroupCalendarSubscribe {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /Subscribe to this Group's Calendar/i }))
    const copyButton = screen.getByRole('button', { name: /^Copy$/i })
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultProps.eventCalendarUrl)
  })

  it('clicking the URL text in the modal copies it to clipboard', () => {
    render(<GroupCalendarSubscribe {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /Subscribe to this Group's Calendar/i }))
    fireEvent.click(screen.getByText(defaultProps.eventCalendarUrl))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultProps.eventCalendarUrl)
  })

  it('Google Calendar button copies URL and opens add-by-url page in new tab', () => {
    render(<GroupCalendarSubscribe {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /Subscribe to this Group's Calendar/i }))
    const googleButton = screen.getByRole('button', { name: /Google Calendar/i })
    fireEvent.click(googleButton)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultProps.eventCalendarUrl)
    expect(window.open).toHaveBeenCalledWith(GOOGLE_CALENDAR_ADD_URL, '_blank', 'noopener,noreferrer')
  })

  it('Apple Calendar button sets location.href to webcal URL', () => {
    render(<GroupCalendarSubscribe {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /Subscribe to this Group's Calendar/i }))

    const locationHref = {}
    const originalLocation = window.location
    delete window.location
    window.location = locationHref

    fireEvent.click(screen.getByRole('button', { name: /Apple Calendar/i }))

    expect(locationHref.href).toBe('webcal://example.com/calendar/feed.ics')

    window.location = originalLocation
  })

  describe('RSVP calendar subscription (user events)', () => {
    const rsvpCalendarUrl = 'https://example.com/user/123/calendar-abc.ics'
    const rsvpProps = {
      eventCalendarUrl: rsvpCalendarUrl,
      buttonLabel: 'Subscribe to all the Hylo events you have RSVPed to',
      modalTitle: 'Subscribe to all the Hylo events you have RSVPed to'
    }

    it('renders button with RSVP calendar label when buttonLabel is provided', () => {
      render(<GroupCalendarSubscribe {...rsvpProps} />)
      expect(screen.getByRole('button', { name: /Subscribe to all the Hylo events you have RSVPed to/i })).toBeInTheDocument()
    })

    it('opens modal with RSVP modal title and calendar URL when button is clicked', () => {
      render(<GroupCalendarSubscribe {...rsvpProps} />)
      fireEvent.click(screen.getByRole('button', { name: /Subscribe to all the Hylo events you have RSVPed to/i }))
      expect(screen.getByText('Subscribe to all the Hylo events you have RSVPed to')).toBeInTheDocument()
      expect(screen.getByText(rsvpCalendarUrl)).toBeInTheDocument()
    })

    it('Copy button copies RSVP calendar URL to clipboard', () => {
      render(<GroupCalendarSubscribe {...rsvpProps} />)
      fireEvent.click(screen.getByRole('button', { name: /Subscribe to all the Hylo events you have RSVPed to/i }))
      fireEvent.click(screen.getByRole('button', { name: /^Copy$/i }))
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(rsvpCalendarUrl)
    })

    it('Apple Calendar button sets location.href to webcal URL for RSVP calendar', () => {
      render(<GroupCalendarSubscribe {...rsvpProps} />)
      fireEvent.click(screen.getByRole('button', { name: /Subscribe to all the Hylo events you have RSVPed to/i }))

      const locationHref = {}
      const originalLocation = window.location
      delete window.location
      window.location = locationHref

      fireEvent.click(screen.getByRole('button', { name: /Apple Calendar/i }))

      expect(locationHref.href).toBe('webcal://example.com/user/123/calendar-abc.ics')

      window.location = originalLocation
    })

    it('Google Calendar button copies RSVP URL and opens add-by-url page', () => {
      render(<GroupCalendarSubscribe {...rsvpProps} />)
      fireEvent.click(screen.getByRole('button', { name: /Subscribe to all the Hylo events you have RSVPed to/i }))
      fireEvent.click(screen.getByRole('button', { name: /Google Calendar/i }))
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(rsvpCalendarUrl)
      expect(window.open).toHaveBeenCalledWith(GOOGLE_CALENDAR_ADD_URL, '_blank', 'noopener,noreferrer')
    })
  })
})
