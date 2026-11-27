import { DateTime } from 'luxon'
import { uniq } from 'lodash'
import { placementsForPost } from './placement'

// Task notifications: assigned to you, a task you're on (or created) changed status, and a
// task you're on is due tomorrow or today. They go out in-app and as push notifications,
// following each person's existing per-group notification settings.

/** Several moves of the same task inside this window are shown to a person as one notification. */
const STATUS_CHANGE_COLLAPSE_MINUTES = 10

/** Due reminders go out from this hour of the day, in the task's time zone. */
const DUE_REMINDER_HOUR = 8

const idsOf = models => models.map(m => String(m.id))

async function firstGroupId (post, groupId, transacting) {
  if (groupId) return groupId
  const placements = await placementsForPost(post.id, { transacting })
  return placements[0]?.groupId
}

/** Tells people they were put on a task by someone else. */
export async function notifyTaskAssigned ({ post, userIds, actorId, groupId, transacting }) {
  const readers = uniq(userIds.map(String)).filter(id => id !== String(actorId))
  if (readers.length === 0) return
  const group = await firstGroupId(post, groupId, transacting)
  await Activity.saveForReasons(readers.map(readerId => ({
    reader_id: readerId,
    actor_id: actorId,
    post_id: post.id,
    group_id: group,
    reasons: [Activity.Reason.TaskAssigned]
  })), transacting)
}

/**
 * Tells a task's assignees and creator (but not the person who moved it) that it changed
 * column. A move soon after an earlier one updates that notification instead of adding another.
 */
export async function notifyTaskStatusChanged ({ post, status, actorId, groupId, transacting }) {
  const assignees = idsOf((await post.members().fetch({ transacting })).models)
  const readers = uniq([...assignees, String(post.get('user_id'))]).filter(id => id && id !== String(actorId))
  if (readers.length === 0) return

  const meta = { statusName: status.get('name'), statusCategory: status.get('category') }
  const since = new Date(Date.now() - STATUS_CHANGE_COLLAPSE_MINUTES * 60 * 1000)
  const recentQuery = bookshelf.knex('activities')
    .where({ post_id: post.id })
    .whereIn('reader_id', readers)
    .where('created_at', '>', since)
    .whereRaw("meta->'reasons' @> ?::jsonb", [JSON.stringify([Activity.Reason.TaskStatusChanged])])
    .select('id', 'reader_id', 'meta')
  if (transacting) recentQuery.transacting(transacting)
  const recent = await recentQuery

  for (const row of recent) {
    const update = bookshelf.knex('activities').where({ id: row.id })
      .update({ meta: JSON.stringify({ ...row.meta, ...meta }), actor_id: actorId })
    if (transacting) update.transacting(transacting)
    await update
  }

  const alreadyTold = new Set(recent.map(row => String(row.reader_id)))
  const fresh = readers.filter(id => !alreadyTold.has(id))
  if (fresh.length === 0) return
  const group = await firstGroupId(post, groupId, transacting)
  await Activity.saveForReasons(fresh.map(readerId => ({
    reader_id: readerId,
    actor_id: actorId,
    post_id: post.id,
    group_id: group,
    reasons: [Activity.Reason.TaskStatusChanged],
    meta
  })), transacting)
}

/**
 * Reminds assignees about unfinished tasks due tomorrow or today. Meant to run hourly:
 * each reminder is sent once, from 8am in the task's time zone, and recorded in the task
 * event log so it is never repeated.
 * @returns {Promise<number>} how many reminders were sent
 */
export async function sendTaskDueReminders (now = new Date()) {
  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const earliest = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const tasks = await Post.query(q => {
    q.where({ type: Post.Type.TASK, active: true })
    q.whereNull('fulfilled_at')
    q.whereBetween('end_time', [earliest, horizon])
  }).fetchAll()

  let sent = 0
  for (const post of tasks.models) {
    const zone = post.get('timezone') || 'UTC'
    const localNow = DateTime.fromJSDate(now).setZone(zone)
    if (!localNow.isValid || localNow.hour < DUE_REMINDER_HOUR) continue
    const due = DateTime.fromJSDate(post.get('end_time')).setZone(zone)
    const days = Math.round(due.startOf('day').diff(localNow.startOf('day'), 'days').days)
    const when = days === 1 ? 'tomorrow' : days === 0 ? 'today' : null
    if (!when) continue

    const dueDate = due.toISODate()
    const already = await bookshelf.knex('task_events')
      .where({ post_id: post.id, type: TaskEvent.Type.DUE_REMINDER })
      .whereRaw("meta->>'when' = ? and meta->>'dueDate' = ?", [when, dueDate])
      .first('id')
    if (already) continue

    const assignees = idsOf((await post.members().fetch()).models)
    await TaskEvent.log({ postId: post.id, groupIds: [], type: TaskEvent.Type.DUE_REMINDER, meta: { when, dueDate } })
    if (assignees.length === 0) continue

    await Activity.saveForReasons(assignees.map(readerId => ({
      reader_id: readerId,
      actor_id: post.get('user_id'),
      post_id: post.id,
      group_id: undefined,
      reasons: [Activity.Reason.TaskDueSoon],
      meta: { when }
    })))
    sent += assignees.length
  }
  return sent
}
