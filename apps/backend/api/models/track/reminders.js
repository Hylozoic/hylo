/* global bookshelf, Activity, Group, GroupMembership, PostUser */
import { learnerMembershipSql } from './progress'
// D63: learners who stall in a track get one reminder after 7 idle days and one after
// 21, never more than two per enrollment. A reminder links to their next action and
// goes in the app and by email, following their group's email setting.
//
// Idle time runs from the later of their last completed action (settings.lastActionAt,
// recorded by Post.checkCompletedTrack) and when they enrolled. Each reminder has a
// grace window, so a missed daily run still sends it, but someone idle for months when
// this starts gets nothing. The count (settings.trackRemindersSent) and the time of the
// last one (settings.trackReminderLastAt) live on the enrollment; Group.settleJoin
// clears them when someone enrolls again. Whoever set the track space up is a member
// without being a learner, and gets no reminders (progress.learnerMembershipSql).

export const TRACK_REMINDER_REASON = 'trackReminder'
export const REMINDER_IDLE_DAYS = [7, 21]
export const REMINDER_GRACE_DAYS = 14
export const MIN_DAYS_BETWEEN_REMINDERS = 7
export const MAX_REMINDERS = REMINDER_IDLE_DAYS.length

const DAY = 24 * 60 * 60 * 1000
const UNLISTED_STATUSES = ['draft', 'archived']

const toTime = value => {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

/** When the learner last did something in the track: their last action, or enrolling. */
export function lastActivityAt (membership) {
  const settings = membership.settings || {}
  const times = [toTime(settings.lastActionAt), toTime(membership.created_at)].filter(time => time != null)
  return times.length ? Math.max(...times) : null
}

/**
 * Which reminder (0 for the 7-day one, 1 for the 21-day one) is due, or null.
 * @param {{ idleDays: number, sent?: number, daysSinceLastReminder?: number|null }} state
 */
export function dueReminderIndex ({ idleDays, sent = 0, daysSinceLastReminder = null }) {
  if (sent >= MAX_REMINDERS) return null
  if (daysSinceLastReminder != null && daysSinceLastReminder < MIN_DAYS_BETWEEN_REMINDERS) return null
  for (let index = REMINDER_IDLE_DAYS.length - 1; index >= 0; index--) {
    const threshold = REMINDER_IDLE_DAYS[index]
    if (idleDays >= threshold && idleDays < threshold + REMINDER_GRACE_DAYS) {
      return index >= sent ? index : null
    }
  }
  return null
}

/** Active, unfinished enrollments in live tracks that have been idle long enough to check. */
export async function candidateEnrollments (now = new Date()) {
  const newestIdle = new Date(now.getTime() - REMINDER_IDLE_DAYS[0] * DAY)
  const oldestIdle = new Date(now.getTime() - (REMINDER_IDLE_DAYS[REMINDER_IDLE_DAYS.length - 1] + REMINDER_GRACE_DAYS) * DAY)
  const lastActivity = 'GREATEST(gm.created_at, COALESCE(NULLIF(gm.settings ->> \'lastActionAt\', \'\')::timestamptz, gm.created_at))'

  return bookshelf.knex('group_memberships as gm')
    .join('groups as g', 'g.id', 'gm.group_id')
    .join('tracks as t', 't.id', 'g.track_id')
    .join('users as u', 'u.id', 'gm.user_id')
    .where('gm.active', true)
    .where('g.active', true)
    .where(q => q.whereNull('g.status').orWhereNotIn('g.status', UNLISTED_STATUSES))
    .whereNull('t.deactivated_at')
    .where('t.num_actions', '>', 0)
    .where('u.active', true)
    .whereRaw('gm.settings ->> \'completedAt\' IS NULL')
    .whereRaw(learnerMembershipSql('gm'))
    .whereRaw('COALESCE((gm.settings ->> \'trackRemindersSent\')::int, 0) < ?', [MAX_REMINDERS])
    .whereRaw(`${lastActivity} <= ?`, [newestIdle])
    .whereRaw(`${lastActivity} > ?`, [oldestIdle])
    .orderBy('gm.id')
    .select('gm.id', 'gm.user_id', 'gm.group_id', 'gm.created_at', 'gm.settings', 'g.track_id', 'g.parent_id')
}

/** The first action in the track this learner hasn't completed, or null. */
async function nextActionFor (userId, actions) {
  if (actions.length === 0) return null
  const completed = new Set((await PostUser.query(q => {
    q.where('user_id', userId)
    q.whereIn('post_id', actions.map(action => action.id))
    q.whereNotNull('completed_at')
  }).fetchAll()).map(pu => String(pu.get('post_id'))))
  return actions.find(action => !completed.has(String(action.id))) || null
}

/**
 * The daily job. Sends each due reminder as its own notification and records it on
 * the enrollment. Resolves to how many were sent.
 */
export async function sendTrackReminders (now = new Date()) {
  const enrollments = await candidateEnrollments(now)
  const actionsBySpace = new Map()
  let sent = 0

  for (const enrollment of enrollments) {
    const settings = enrollment.settings || {}
    const since = lastActivityAt(enrollment)
    if (since == null) continue
    const lastReminderAt = toTime(settings.trackReminderLastAt)
    const index = dueReminderIndex({
      idleDays: (now.getTime() - since) / DAY,
      sent: Number(settings.trackRemindersSent) || 0,
      daysSinceLastReminder: lastReminderAt == null ? null : (now.getTime() - lastReminderAt) / DAY
    })
    if (index == null) continue

    const spaceId = String(enrollment.group_id)
    if (!actionsBySpace.has(spaceId)) {
      const space = await Group.find(spaceId)
      actionsBySpace.set(spaceId, space ? await space.actionPosts() : [])
    }
    const nextAction = await nextActionFor(enrollment.user_id, actionsBySpace.get(spaceId))
    // Everything is done but completion hasn't been recorded yet: nothing to remind about
    if (!nextAction) continue

    await Activity.saveForReasons([{
      reason: TRACK_REMINDER_REASON,
      reader_id: enrollment.user_id,
      actor_id: enrollment.user_id,
      group_id: enrollment.parent_id || enrollment.group_id,
      track_id: enrollment.track_id,
      post_id: nextAction.id,
      meta: { reminderNumber: index + 1 }
    }])

    const membership = await GroupMembership.where({ id: enrollment.id }).fetch()
    membership.addSetting({ trackRemindersSent: index + 1, trackReminderLastAt: now.toISOString() })
    await membership.save({ settings: membership.get('settings') }, { patch: true })
    sent += 1
  }

  return sent
}
