// D62: server events for tracks, sent to Mixpanel only for people who accept analytics
// (lib/analytics/trackServerEvent). They never throw.
import { AnalyticsEvents } from '@hylo/shared'
import { trackServerEvent, trackServerEventForUsers } from '../../../lib/analytics/trackServerEvent'

/**
 * "Track Enrolled" for each new or returning learner, with how they joined the track
 * space (for example 'track' from the enroll button, or a checkout or invitation).
 * @param {GroupMembership[]} memberships the learners' track-space memberships
 */
export function sendTrackEnrolledEvents (memberships, { trackId, groupId }) {
  const joinSourceByUserId = new Map(memberships.map(membership =>
    [String(membership.get('user_id')), membership.getSetting('joinSource') || null]))
  return trackServerEventForUsers([...joinSourceByUserId.keys()], AnalyticsEvents.TRACK_ENROLLED, userId => ({
    trackId: String(trackId),
    groupId: String(groupId),
    joinSource: joinSourceByUserId.get(userId) || null
  }))
}

/** "Track Completed" for a learner who just finished every action. */
export function sendTrackCompletedEvent (userId, { trackId, groupId }) {
  return trackServerEvent(userId, AnalyticsEvents.TRACK_COMPLETED, {
    trackId: String(trackId),
    groupId: String(groupId)
  })
}
