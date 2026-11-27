import { GraphQLError } from 'graphql'
import { canEditPost, canManageContentInGroup } from '../../models/post/postEditPermissions'
import { assignTask as assign, isInTaskGroup, unassignTask as unassign } from '../../models/task/assignees'
import { joinSpace } from './spaces'
import { moveTask as move } from '../../models/task/placement'
import {
  createTaskStatus as createStatus,
  deleteTaskStatus as deleteStatus,
  updateTaskStatus as updateStatus
} from '../../models/task/statuses'

// Task mutations: working on tasks (move, assign) is open to anyone in the task's groups;
// changing a board's columns needs Manage Content or Administration in the group.

async function findTask (userId, postId) {
  const post = postId && await Post.find(postId)
  if (!post || !post.get('active')) throw new GraphQLError('Task not found')
  if (post.get('type') !== Post.Type.TASK) throw new GraphQLError('This post is not a task')
  if (!(await canEditPost(userId, post))) {
    throw new GraphQLError("You don't have permission to modify this task")
  }
  return post
}

/** Columns are managed with the roles of the group itself; a space uses its parent group's roles. */
async function assertCanManageBoard (userId, groupId) {
  const group = groupId && await Group.find(groupId)
  if (!group) throw new GraphQLError('Group not found')
  const roleScopeId = await Group.roleScopeId(group)
  if (!(await canManageContentInGroup(userId, roleScopeId))) {
    throw new GraphQLError("You don't have permission to change this board's columns")
  }
  return group
}

export async function createTaskStatus (userId, { groupId, name, category }) {
  const group = await assertCanManageBoard(userId, groupId)
  return createStatus({ groupId: group.id, name, category: category || undefined })
}

export async function updateTaskStatus (userId, { id, name, category, order }) {
  const status = await TaskStatus.find(id)
  if (!status) throw new GraphQLError('Column not found')
  await assertCanManageBoard(userId, status.get('group_id'))
  return updateStatus({ id, name, category, order })
}

export async function deleteTaskStatus (userId, { id }) {
  const status = await TaskStatus.find(id)
  if (!status) throw new GraphQLError('Column not found')
  await assertCanManageBoard(userId, status.get('group_id'))
  return deleteStatus({ id })
}

export async function moveTask (userId, { postId, groupId, taskStatusId, index }) {
  const post = await findTask(userId, postId)
  await move({ post, groupId, statusId: taskStatusId, index, actorId: userId })
  Post.afterRelatedMutation(post.id, { changeContext: 'completion' })
  return Post.find(post.id)
}

/**
 * Someone taking a task in a project space they have not joined yet joins the space as part
 * of taking it. Only spaces they could join on their own (joinSpace applies the space's
 * access rules); anything else is left to the permission check that follows.
 */
async function joinTaskSpaces (userId, postId) {
  const post = postId && await Post.find(postId)
  if (!post || post.get('type') !== Post.Type.TASK || await isInTaskGroup(userId, post)) return
  await post.load('groups')
  for (const group of post.relations.groups.models) {
    if (group.get('type') !== 'space' || !group.get('active')) continue
    try {
      await joinSpace(userId, group.id)
    } catch (e) {
      // Not a space this person can join by themselves
    }
  }
}

export async function assignTask (userId, { postId, userId: assigneeId }) {
  if (userId && (!assigneeId || String(assigneeId) === String(userId))) await joinTaskSpaces(userId, postId)
  const post = await findTask(userId, postId)
  await bookshelf.knex.transaction(transacting =>
    assign({ post, userIds: [assigneeId || userId], actorId: userId, transacting }))
  return Post.find(post.id)
}

export async function unassignTask (userId, { postId, userId: assigneeId }) {
  const post = await findTask(userId, postId)
  await bookshelf.knex.transaction(transacting =>
    unassign({ post, userIds: [assigneeId || userId], actorId: userId, transacting }))
  return Post.find(post.id)
}
