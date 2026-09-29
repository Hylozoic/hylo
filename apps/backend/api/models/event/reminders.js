/* global Activity, EventInvitation, Post, bookshelf */
// Event reminders (D44), run by the hourly cron. About a day before an event starts:
//
//   eventReminder  one push and email to everyone who answered going or interested,
//                  following each group's email and push settings (the notification
//                  rules drop a channel the reader's groups turn off)
//   eventNudge     one in-app nudge to invitees who haven't answered
//
// Nobody who answered 'no' hears anything, and the host is not reminded of their own
// event. Hylo has no repeating events: each event post has one start time, so the
// sent mark includes it. An event moved to another time gets a reminder for the new
// time; the same time is never reminded twice.
//
// An event is picked up on the first hourly run once it starts within
// REMINDER_HOURS_BEFORE + 1 hours, and stays eligible until REMINDER_HOURS_BEFORE - 2
// hours before it starts, so a missed run or an event created late still gets one.
import sentry from '../../../lib/sentry'
import { groupKeyFor, sentNoticeKeys } from '../notification/grouping'

export const REMINDER_HOURS_BEFORE = 24
const WINDOW_EARLIEST_HOURS = REMINDER_HOURS_BEFORE + 1
const WINDOW_LATEST_HOURS = REMINDER_HOURS_BEFORE - 2

const HOUR = 60 * 60 * 1000

// One key per event and start time marks both the reminders and the nudges as sent
export function reminderKeyFor (event) {
  const startTime = new Date(event.get('start_time')).toISOString()
  return `${groupKeyFor('eventReminder', { postId: event.id })}:${startTime}`
}

async function answersFor (event) {
  const hostId = event.get('user_id')
  const rows = await bookshelf.knex('event_invitations')
    .join('users', 'users.id', 'event_invitations.user_id')
    .where('event_invitations.event_id', event.id)
    .where('users.active', true)
    .select('event_invitations.user_id', 'event_invitations.response', 'event_invitations.inviter_id')
  return rows.filter(row => !hostId || String(row.user_id) !== String(hostId))
}

export async function eventsDueForReminder (now = new Date()) {
  const events = await Post.query(q => {
    q.where({ type: Post.Type.EVENT, active: true })
    q.where('start_time', '>', new Date(now.getTime() + WINDOW_LATEST_HOURS * HOUR))
    q.where('start_time', '<=', new Date(now.getTime() + WINDOW_EARLIEST_HOURS * HOUR))
  }).fetchAll()
  const sent = await sentNoticeKeys(events.map(reminderKeyFor))
  return events.models.filter(event => !sent.has(reminderKeyFor(event)))
}

export async function sendEventReminders ({ now = new Date() } = {}) {
  const events = await eventsDueForReminder(now)
  let reminded = 0
  let nudged = 0
  for (const event of events) {
    try {
      const answers = await answersFor(event)
      const groupKey = reminderKeyFor(event)
      // A nudge names whoever sent the invitation; a reminder comes from the host
      const notice = (reason, row) => ({
        reader_id: row.user_id,
        actor_id: (reason === 'eventNudge' && row.inviter_id) || event.get('user_id'),
        post_id: event.id,
        reason,
        group_key: groupKey,
        meta: { startTime: event.get('start_time'), ...(row.response ? { response: row.response } : {}) }
      })
      const reminders = answers
        .filter(row => row.response && EventInvitation.going(row.response))
        .map(row => notice('eventReminder', row))
      const nudges = answers.filter(row => !row.response).map(row => notice('eventNudge', row))
      if (reminders.length + nudges.length === 0) continue
      await Activity.saveForReasons(reminders.concat(nudges))
      reminded += reminders.length
      nudged += nudges.length
    } catch (err) {
      sentry.error(err, null, { postId: event.id })
    }
  }
  return { events: events.length, reminded, nudged }
}
