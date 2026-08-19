import { PLACEHOLDER_COPY, PLACEHOLDER_NAME } from '../constants'
import { sid } from '../helpers'
import { MAIN_COORDINATOR_ROLE_ID, TRACK_SPACE_ID } from './groups'

export const TRACK_ID = sid('track', 'onboarding')

export function buildTrack () {
  return {
    id: TRACK_ID,
    name: PLACEHOLDER_NAME,
    description: PLACEHOLDER_COPY,
    groupId: TRACK_SPACE_ID,
    actionDescriptor: PLACEHOLDER_NAME,
    actionDescriptorPlural: PLACEHOLDER_NAME,
    completionMessage: PLACEHOLDER_COPY,
    publishedAt_offset: -86400 * 30,
    accessControlled: false,
    canAccess: true,
    completionRole: {
      id: MAIN_COORDINATOR_ROLE_ID,
      name: PLACEHOLDER_NAME,
      emoji: '⭐'
    },
    numActions: 4,
    numPeopleCompleted: 12
  }
}

/** Ordered track action posts (discussion-type completion steps) */
export function buildTrackActions (peopleById, meId) {
  const creator = peopleById[meId]
  return [
    trackActionPost(sid('track-action', '001'), 0, creator),
    trackActionPost(sid('track-action', '002'), 1, creator),
    trackActionPost(sid('track-action', '003'), 2, creator),
    trackActionPost(sid('track-action', '004'), 3, creator)
  ]
}

function trackActionPost (id, order, creator) {
  return {
    id,
    title: PLACEHOLDER_NAME,
    details: `<p>${PLACEHOLDER_COPY}</p>`,
    type: 'discussion',
    trackOrder: order,
    completionAction: 'button',
    creator,
    createdAt_offset: -86400 * (20 - order),
    commentsTotal: 0,
    postReactionsTotal: 0
  }
}
