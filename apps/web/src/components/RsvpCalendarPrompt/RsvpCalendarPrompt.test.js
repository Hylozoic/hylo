import React from 'react'
import { Provider } from 'react-redux'
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { generateStore } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import getMe from 'store/selectors/getMe'
import respondToEvent from 'store/actions/respondToEvent'
import { RESPOND_TO_EVENT } from 'store/constants'
import isWebView from 'util/webView'
import RsvpCalendarPrompt from './RsvpCalendarPrompt'
import reducer, {
  closeRsvpCalendarPrompt,
  initialState,
  shouldOfferRsvpCalendar
} from './RsvpCalendarPrompt.store'

jest.mock('routes/GroupCalendarSubscribe/CalendarSubscribeModal', () => {
  return function MockCalendarSubscribeModal ({ calendarUrl }) {
    return <div data-testid='calendar-subscribe-modal'>{calendarUrl}</div>
  }
})

const RSVP_CALENDAR_URL = 'https://example.com/user/1/calendar-abc.ics'
const event = { id: '10', groups: [] }
const EVENT_POST = {
  id: event.id,
  type: 'event',
  title: 'Picnic',
  startTime: '2026-11-08T18:00:00.000Z',
  endTime: '2026-11-08T20:00:00.000Z',
  location: 'Dolores Park'
}
const PROMPT_TITLE = 'Add this event to your calendar?'
const SUBSCRIBE_ONLY_TITLE = 'Add your RSVPs to your calendar?'

describe('RsvpCalendarPrompt.store', () => {
  it('opens after a successful Going or Interested RSVP', () => {
    expect(reducer(initialState, { type: RESPOND_TO_EVENT, meta: { response: 'yes' } }).open).toBe(true)
    expect(reducer(initialState, { type: RESPOND_TO_EVENT, meta: { response: 'interested' } }).open).toBe(true)
  })

  it('remembers which event was RSVPed to', () => {
    expect(reducer(initialState, { type: RESPOND_TO_EVENT, meta: { id: '10', response: 'yes' } }).postId).toBe('10')
    expect(reducer({ open: false, postId: '10' }, { type: RESPOND_TO_EVENT, meta: { id: '11', response: 'interested' } }).postId).toBe('11')
  })

  it('stays closed after Not Going, or a failed RSVP', () => {
    expect(reducer(initialState, { type: RESPOND_TO_EVENT, meta: { response: 'no' } }).open).toBe(false)
    expect(reducer(initialState, { type: RESPOND_TO_EVENT, meta: { response: 'yes' }, error: true }).open).toBe(false)
  })

  it('closes', () => {
    expect(reducer({ open: true }, closeRsvpCalendarPrompt()).open).toBe(false)
  })

  it('offers the RSVP calendar until the person subscribes or opts out', () => {
    expect(shouldOfferRsvpCalendar({})).toBe(true)
    expect(shouldOfferRsvpCalendar({ toursSeen: ['global-chrome'] })).toBe(true)
    expect(shouldOfferRsvpCalendar({ rsvpCalendarSub: true })).toBe(false)
    expect(shouldOfferRsvpCalendar({ hideRsvpCalendarPrompt: false })).toBe(true)
    expect(shouldOfferRsvpCalendar({ hideRsvpCalendarPrompt: true })).toBe(false)
  })
})

describe('RsvpCalendarPrompt', () => {
  let updateMeCalls

  beforeEach(() => {
    updateMeCalls = []
    mockGraphqlServer.use(
      graphql.operation(({ query, variables }) => {
        if (query.includes('respondToEvent')) {
          return HttpResponse.json({ data: { respondToEvent: { success: true } } })
        }
        if (query.includes('updateMe')) {
          updateMeCalls.push(variables.changes)
          return HttpResponse.json({
            data: {
              updateMe: {
                id: '1',
                rsvpCalendarUrl: variables.changes.settings.rsvpCalendarSub ? RSVP_CALENDAR_URL : null,
                settings: variables.changes.settings
              }
            }
          })
        }
        return HttpResponse.json({ data: {} })
      })
    )
  })

  afterEach(() => {
    isWebView.mockReturnValue(false)
    jest.restoreAllMocks()
    // revokeObjectURL is left in place for the download's delayed revoke
    delete URL.createObjectURL
  })

  function setup (settings = {}, post = EVENT_POST) {
    const session = orm.mutableSession(orm.getEmptyState())
    session.Me.create({ id: '1', settings })
    session.Post.create(post)
    const store = generateStore({ orm: session.state })
    render(
      <Provider store={store}>
        <RsvpCalendarPrompt />
      </Provider>
    )
    const rsvp = response => act(() => store.dispatch(respondToEvent(event, response)))
    return { store, rsvp }
  }

  it('shows after a positive RSVP', async () => {
    const { rsvp } = setup()
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument()
    await rsvp('yes')
    expect(await screen.findByText(PROMPT_TITLE)).toBeInTheDocument()
  })

  it('does not show after a Not Going RSVP', async () => {
    const { rsvp } = setup()
    await rsvp('no')
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument()
  })

  it('"Not now" closes it, and the next positive RSVP asks again', async () => {
    const { rsvp } = setup()
    await rsvp('interested')
    fireEvent.click(await screen.findByText('Not now'))
    await waitFor(() => expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument())
    expect(updateMeCalls).toEqual([])

    await rsvp('yes')
    expect(await screen.findByText(PROMPT_TITLE)).toBeInTheDocument()
  })

  it('does not show again after "Don\'t ask again", which is saved on the account', async () => {
    const { store, rsvp } = setup({ toursSeen: ['global-chrome'] })
    await rsvp('yes')
    fireEvent.click(await screen.findByText('Don\'t ask again'))
    // The optimistic update marks it on `me` straight away, keeping the other settings
    expect(getMe(store.getState()).settings).toEqual({ toursSeen: ['global-chrome'], hideRsvpCalendarPrompt: true })
    await waitFor(() => expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument())
    await waitFor(() => expect(updateMeCalls).toEqual([{ settings: { hideRsvpCalendarPrompt: true } }]))
    await waitFor(() => expect(getMe(store.getState()).settings.hideRsvpCalendarPrompt).toBe(true))

    await rsvp('yes')
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument()
  })

  it('does not show for someone already opted out', async () => {
    const { rsvp } = setup({ hideRsvpCalendarPrompt: true })
    await rsvp('yes')
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument()
  })

  it('subscribes to the RSVP feed, shows its URL, and does not ask again', async () => {
    const { rsvp } = setup()
    await rsvp('yes')
    fireEvent.click(await screen.findByRole('button', { name: 'Subscribe' }))
    expect(await screen.findByTestId('calendar-subscribe-modal')).toHaveTextContent(RSVP_CALENDAR_URL)
    expect(updateMeCalls).toEqual([{ settings: { rsvpCalendarSub: true } }])
    await waitFor(() => expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument())

    await rsvp('interested')
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument()
  })

  it('does not show for someone already subscribed', async () => {
    const { rsvp } = setup({ rsvpCalendarSub: true })
    await rsvp('yes')
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument()
  })

  describe('adding just this event', () => {
    it('is the main option, alongside subscribing', async () => {
      const { rsvp } = setup()
      await rsvp('yes')
      expect(await screen.findByText(PROMPT_TITLE)).toBeInTheDocument()
      expect(screen.getByTestId('rsvp-calendar-prompt-event-title')).toHaveTextContent('Picnic')
      expect(screen.getByRole('button', { name: 'Add to Google Calendar' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add to Apple or Outlook' })).toBeInTheDocument()
      expect(screen.getByText('Or keep all your RSVPs in sync')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Don\'t ask again' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
    })

    it('opens a Google Calendar link for the event, then closes without saving anything', async () => {
      const open = jest.spyOn(window, 'open').mockImplementation(() => null)
      const { rsvp } = setup()
      await rsvp('yes')
      fireEvent.click(await screen.findByRole('button', { name: 'Add to Google Calendar' }))

      expect(open).toHaveBeenCalledTimes(1)
      const [url, target] = open.mock.calls[0]
      expect(target).toBe('_blank')
      const parsed = new URL(url)
      expect(parsed.origin + parsed.pathname).toBe('https://calendar.google.com/calendar/render')
      expect(parsed.searchParams.get('text')).toBe('Picnic')
      expect(parsed.searchParams.get('dates')).toBe('20261108T180000Z/20261108T200000Z')
      expect(parsed.searchParams.get('location')).toBe('Dolores Park')
      expect(parsed.searchParams.get('details')).toContain(`/post/${event.id}`)

      await waitFor(() => expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument())
      expect(updateMeCalls).toEqual([])
      // Only closed this time: the next positive RSVP asks again
      await rsvp('interested')
      expect(await screen.findByText(PROMPT_TITLE)).toBeInTheDocument()
    })

    it('downloads an .ics file for the event, then closes', async () => {
      // jsdom has no object URLs
      const blobs = []
      URL.createObjectURL = jest.fn(blob => { blobs.push(blob); return 'blob:ics' })
      URL.revokeObjectURL = jest.fn()
      const click = jest.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
        expect(this.getAttribute('download')).toBe('picnic.ics')
        expect(this.getAttribute('href')).toBe('blob:ics')
      })
      const { rsvp } = setup()
      await rsvp('yes')
      fireEvent.click(await screen.findByRole('button', { name: 'Add to Apple or Outlook' }))

      expect(click).toHaveBeenCalledTimes(1)
      expect(blobs).toHaveLength(1)
      expect(blobs[0].type).toBe('text/calendar;charset=utf-8')
      const ics = await blobs[0].text()
      expect(ics).toContain('UID:event-10-hylo.com')
      expect(ics).toContain('SUMMARY:Picnic')
      expect(ics).toContain('DTSTART:20261108T180000Z')
      await waitFor(() => expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument())
      expect(updateMeCalls).toEqual([])
    })

    it('in the mobile app only offers Google Calendar, since the WebView cannot download files', async () => {
      isWebView.mockReturnValue(true)
      const { rsvp } = setup()
      await rsvp('yes')
      expect(await screen.findByRole('button', { name: 'Add to Google Calendar' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add to Apple or Outlook' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument()
    })

    it('only offers the subscription when the event has no start time', async () => {
      const { rsvp } = setup({}, { id: event.id, type: 'event', title: 'Picnic' })
      await rsvp('yes')
      expect(await screen.findByText(SUBSCRIBE_ONLY_TITLE)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add to Google Calendar' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument()
    })
  })
})
