/* global Activity, Notification, bookshelf */
// Social feedback arrives in bursts (D7): reactions (D15), RSVPs (D45) and votes on
// proposals (D46). Each reader gets one notice per item that keeps a running count
// ("Sam and 3 others reacted"), and at most one push per item per hour.
//
// An activity's group_key names what it is about: `<reason>:<post|comment>:<id>`.
//
//   Grouped reasons (GROUPED_REASONS): saving one supersedes the reader's unread
//   activity with the same key. The new row carries every actor so far
//   (meta.actorIds, latest first, and meta.actorCount); the older row and its
//   notifications are removed, so the bell and the unread count show one notice.
//   An actor already counted for that reader and item adds nothing.
//
//   Other keyed notices (reminders, closing soon, results): the key only lets a job
//   tell that it already sent that notice (see sentNoticeKeys).
//
// A grouped push goes out at most once per GROUPED_PUSH_INTERVAL_MINUTES for a key
// and reader. Notification#send asks isGroupedPushThrottled first and calls
// recordGroupedPush after sending; meta.lastPushAt moves with the group when it is
// superseded.
import { uniq } from 'lodash'

export const GROUPED_PUSH_INTERVAL_MINUTES = 60

export const GROUPED_REASONS = ['reaction', 'eventRsvp', 'proposalVote']

export function groupKeyFor (reason, { postId, commentId } = {}) {
  if (commentId) return `${reason}:comment:${commentId}`
  if (postId) return `${reason}:post:${postId}`
  throw new Error('groupKeyFor needs a post or comment id')
}

export function isGroupedKey (key) {
  return typeof key === 'string' && GROUPED_REASONS.some(reason => key.startsWith(`${reason}:`))
}

const withTransaction = (query, transacting) => transacting ? query.transacting(transacting) : query

// Deletes activities and their notifications. An unread activity whose in-app
// notification was already sent was counted in the reader's new_notification_count,
// so that count goes down with it (never below zero).
export async function removeActivities (ids, transacting) {
  if (!ids || ids.length === 0) return
  const knex = bookshelf.knex
  const counted = await withTransaction(knex('notifications')
    .join('activities', 'activities.id', 'notifications.activity_id')
    .whereIn('notifications.activity_id', ids)
    .where('notifications.medium', Notification.MEDIUM.InApp)
    .whereNotNull('notifications.sent_at')
    .where('activities.unread', true)
    .groupBy('notifications.user_id')
    .select('notifications.user_id')
    .count('* as count'), transacting)

  for (const row of counted) {
    await withTransaction(knex('users')
      .where('id', row.user_id)
      .update({
        new_notification_count: knex.raw('GREATEST(COALESCE(new_notification_count, 0) - ?, 0)', [Number(row.count)])
      }), transacting)
  }

  await Notification.where('activity_id', 'in', ids).destroy({ transacting, require: false })
  await Activity.where('id', 'in', ids).destroy({ transacting, require: false })
}

const latestTime = times => times
  .filter(Boolean)
  .map(time => new Date(time))
  .filter(date => !isNaN(date))
  .sort((a, b) => b - a)[0]

// The attributes to save for a grouped activity, or null when this actor is already
// counted for this reader and item. Removes the unread activity it supersedes.
async function supersede (attributes, transacting) {
  const readerId = attributes.reader_id
  const groupKey = attributes.group_key
  const previous = await Activity.query(q => {
    q.where({ reader_id: readerId, group_key: groupKey })
    q.orderBy('id', 'desc')
  }).fetchAll({ transacting })

  const actorIdsOf = activity => (activity.get('meta')?.actorIds || [activity.get('actor_id')])
    .filter(id => id !== null && id !== undefined)
    .map(String)

  const actorId = String(attributes.actor_id)
  if (previous.models.some(activity => actorIdsOf(activity).includes(actorId))) return null

  const unread = previous.models.filter(activity => activity.get('unread'))
  const earlierActorIds = uniq(unread.flatMap(actorIdsOf))
  const lastPushAt = latestTime(previous.models.map(activity => activity.get('meta')?.lastPushAt))

  await removeActivities(unread.map(activity => activity.id), transacting)

  const actorIds = [actorId, ...earlierActorIds]
  return {
    ...attributes,
    meta: {
      ...attributes.meta,
      actorIds,
      actorCount: actorIds.length,
      ...(lastPushAt ? { lastPushAt: lastPushAt.toISOString() } : {})
    }
  }
}

// Activity.createWithNotifications for a grouped key. One reader and item at a time:
// an advisory lock keeps two reactions arriving together from making two rows.
export function saveGrouped (attributes, trx) {
  const run = async transacting => {
    await bookshelf.knex.raw('SELECT pg_advisory_xact_lock(hashtext(?))',
      [`activity-group:${attributes.reader_id}:${attributes.group_key}`]).transacting(transacting)
    const attrs = await supersede(attributes, transacting)
    if (!attrs) return null
    const activity = await new Activity(Object.assign({ created_at: new Date() }, attrs))
      .save({}, { transacting })
    await activity.createNotifications(transacting)
    return activity
  }
  return trx ? run(trx) : bookshelf.transaction(run)
}

// True when a push for this notification's item already went to the reader within
// GROUPED_PUSH_INTERVAL_MINUTES.
export async function isGroupedPushThrottled (notification) {
  const activity = notification.relations?.activity
  const groupKey = activity?.get('group_key')
  if (!isGroupedKey(groupKey)) return false

  const since = new Date(Date.now() - GROUPED_PUSH_INTERVAL_MINUTES * 60 * 1000)
  const own = latestTime([activity.get('meta')?.lastPushAt])
  if (own && own > since) return true

  const recent = await bookshelf.knex('activities')
    .where({ reader_id: activity.get('reader_id'), group_key: groupKey })
    .whereNot('id', activity.id)
    .whereRaw("(meta->>'lastPushAt')::timestamptz > ?", [since])
    .first('id')
  return !!recent
}

export async function recordGroupedPush (notification) {
  const activity = notification.relations?.activity
  if (!isGroupedKey(activity?.get('group_key'))) return
  await bookshelf.knex('activities')
    .where('id', activity.id)
    .update({
      meta: bookshelf.knex.raw("COALESCE(meta, '{}'::jsonb) || jsonb_build_object('lastPushAt', ?::text)", [new Date().toISOString()])
    })
}

// The keys among `keys` that some activity already carries, for jobs that send a
// notice once (reminders, closing soon).
export async function sentNoticeKeys (keys) {
  if (!keys || keys.length === 0) return new Set()
  const rows = await bookshelf.knex('activities')
    .whereIn('group_key', keys)
    .distinct('group_key')
  return new Set(rows.map(row => row.group_key))
}

// Removes every activity with this key, for example the 'request met' notices when a
// request is reopened.
export async function removeNoticesWithKey (groupKey, transacting) {
  const ids = await withTransaction(bookshelf.knex('activities').where('group_key', groupKey).pluck('id'), transacting)
  return removeActivities(ids, transacting)
}
