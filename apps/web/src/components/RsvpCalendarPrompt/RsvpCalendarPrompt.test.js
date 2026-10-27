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
import RsvpCalendarPrompt from './RsvpCalendarPrompt'
import reducer, {
  RSVP_CALENDAR_PROMPT_ID,
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
const PROMPT_TITLE = 'Add your RSVPs to your calendar?'

describe('RsvpCalendarPrompt.store', () => {
  it('opens after a successful Going or Interested RSVP', () => {
    expect(reducer(initialState, { type: RESPOND_TO_EVENT, meta: { response: 'yes' } }).open).toBe(true)
    expect(reducer(initialState, { type: RESPOND_TO_EVENT, meta: { response: 'interested' } }).open).toBe(true)
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
    expect(shouldOfferRsvpCalendar({ toursSeen: [RSVP_CALENDAR_PROMPT_ID] })).toBe(false)
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

  function setup (settings = {}) {
    const session = orm.mutableSession(orm.getEmptyState())
    session.Me.create({ id: '1', settings })
    session.Post.create({ id: event.id, type: 'event', title: 'Picnic' })
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
    await waitFor(() => expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument())
    await waitFor(() => expect(updateMeCalls).toEqual([{ settings: { toursSeen: ['global-chrome', RSVP_CALENDAR_PROMPT_ID] } }]))
    expect(getMe(store.getState()).settings.toursSeen).toContain(RSVP_CALENDAR_PROMPT_ID)

    await rsvp('yes')
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument()
  })

  it('does not show for someone already opted out', async () => {
    const { rsvp } = setup({ toursSeen: [RSVP_CALENDAR_PROMPT_ID] })
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
})
