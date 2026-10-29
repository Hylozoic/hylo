import { RESPONSES } from '@hylo/presenters/EventInvitationPresenter'
import { RESPOND_TO_EVENT } from 'store/constants'

export const MODULE_NAME = 'RsvpCalendarPrompt'

export const CLOSE_RSVP_CALENDAR_PROMPT = `${MODULE_NAME}/CLOSE`

export const POSITIVE_RSVP_RESPONSES = [RESPONSES.YES, RESPONSES.INTERESTED]

/**
 * Whether to offer the RSVP calendar feed: not once the person has subscribed to it
 * (settings.rsvpCalendarSub) or chosen "Don't ask again" (settings.hideRsvpCalendarPrompt).
 */
export function shouldOfferRsvpCalendar (settings) {
  if (!settings) return false
  if (settings.rsvpCalendarSub) return false
  return !settings.hideRsvpCalendarPrompt
}

export const initialState = { open: false }

// Every RSVP control dispatches respondToEvent, so a successful positive RSVP from any of
// them (post card, grid item, post detail) requests the prompt
export default function reducer (state = initialState, action) {
  if (action.error) return state

  if (action.type === RESPOND_TO_EVENT && POSITIVE_RSVP_RESPONSES.includes(action.meta?.response)) {
    return { ...state, open: true }
  }

  if (action.type === CLOSE_RSVP_CALENDAR_PROMPT) {
    return { ...state, open: false }
  }

  return state
}

export function closeRsvpCalendarPrompt () {
  return { type: CLOSE_RSVP_CALENDAR_PROMPT }
}

export const getRsvpCalendarPromptOpen = state => Boolean(state[MODULE_NAME]?.open)
