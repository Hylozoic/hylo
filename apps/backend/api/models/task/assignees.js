import { GraphQLError } from 'graphql'
import { difference, uniq } from 'lodash'
import { placeTaskOnBoards, placementsForPost } from './placement'
import { notifyTaskAssigned } from './notifications'

// A task's assignees are stored the way project members were: posts_users rows with a
// project role. Changes are written to the task event log for each board the task is on.

const idsOf = models => models.map(m => String(m.id))

async function groupIdsFor (post, transacting) {
  const placements = await placementsForPost(post.id, { transacting })
  return placements.map(p => p.groupId)
}

/** True when the person is an active member of at least one group the task is posted to. */
export async function isInTaskGroup (userId, post, { transacting } = {}) {
  const groupIds = await groupIdsFor(post, transacting)
  if (groupIds.length === 0) return false
  const q = bookshelf.knex('group_memberships')
    .where({ user_id: userId, active: true })
    .whereIn('group_id', groupIds)
    .first('id')
  if (transacting) q.transacting(transacting)
  return !!(await q)
}

/** Adds people to a task. Everyone added must belong to one of the task's groups. */
export async function assignTask ({ post, userIds, actorId, transacting }) {
  const current = idsOf((await post.members().fetch({ transacting })).models)
  const toAdd = difference(uniq(userIds.map(String)), current)
  if (toAdd.length === 0) return post

  for (const userId of toAdd) {
    if (!(await isInTaskGroup(userId, post, { transacting }))) {
      throw new GraphQLError('Only members of the group can be assigned to this task')
    }
  }

  await post.addProjectMembers(toAdd, { transacting })
  const groupIds = await groupIdsFor(post, transacting)
  for (const userId of toAdd) {
    await TaskEvent.log({ postId: post.id, groupIds, actorId, type: TaskEvent.Type.ASSIGNED, meta: { userId } }, { transacting })
  }
  await notifyTaskAssigned({ post, userIds: toAdd, actorId, groupId: groupIds[0], transacting })
  return post
}

/** Removes people from a task. */
export async function unassignTask ({ post, userIds, actorId, transacting }) {
  const current = idsOf((await post.members().fetch({ transacting })).models)
  const toRemove = uniq(userIds.map(String)).filter(id => current.includes(id))
  if (toRemove.length === 0) return post

  await post.removeProjectMembers(toRemove, { transacting })
  const groupIds = await groupIdsFor(post, transacting)
  for (const userId of toRemove) {
    await TaskEvent.log({ postId: post.id, groupIds, actorId, type: TaskEvent.Type.UNASSIGNED, meta: { userId } }, { transacting })
  }
  return post
}

/** Makes the task's assignees exactly this list. */
export async function setTaskAssignees ({ post, userIds, actorId, transacting }) {
  const wanted = uniq((userIds || []).map(String))
  const current = idsOf((await post.members().fetch({ transacting })).models)
  await unassignTask({ post, userIds: difference(current, wanted), actorId, transacting })
  await assignTask({ post, userIds: difference(wanted, current), actorId, transacting })
  return post
}

/** The task fields an update is about to change: any of 'title', 'details', 'due'. Call before saving. */
export function changedTaskFields (post, attrs) {
  const changed = []
  const time = value => (value ? new Date(value).getTime() : null)
  if (attrs.name !== undefined && attrs.name !== post.get('name')) changed.push('title')
  if (attrs.description !== undefined && attrs.description !== post.get('description')) changed.push('details')
  if (attrs.end_time !== undefined && time(attrs.end_time) !== time(post.get('end_time'))) changed.push('due')
  return changed
}

/** Records that someone edited a task, so an overwritten title or description can be traced. */
export async function logTaskEdit ({ post, fields, actorId, transacting }) {
  if (!fields || fields.length === 0) return
  const groupIds = await groupIdsFor(post, transacting)
  await TaskEvent.log({ postId: post.id, groupIds, actorId, type: TaskEvent.Type.EDITED, meta: { fields } }, { transacting })
}

/** Runs once after a task post is created: puts it on its boards, assigns people, logs it. */
export async function setupNewTask (post, userId, opts, transacting) {
  await placeTaskOnBoards(post, { statusId: opts.taskStatusId, transacting })
  const groupIds = await groupIdsFor(post, transacting)
  await TaskEvent.log({ postId: post.id, groupIds, actorId: userId, type: TaskEvent.Type.CREATED }, { transacting })
  if (opts.memberIds && opts.memberIds.length > 0) {
    await assignTask({ post, userIds: opts.memberIds, actorId: userId, transacting })
  }
}
