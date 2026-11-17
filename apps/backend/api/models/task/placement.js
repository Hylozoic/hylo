import { GraphQLError } from 'graphql'

// Where a task sits on each group's board lives on groups_posts (task_status_id, task_position).
// Its category (todo / active / done) lives on the post and is shared by every board:
// completing a task on one board completes it on all of them.

/** Gap left between neighbouring cards so a drop usually updates a single row. */
export const POSITION_GAP = 1024

/** Below this distance two neighbours are too close to fit a card between; the column is renumbered. */
const MIN_GAP = 0.001

const knexFor = (table, transacting) => {
  const q = bookshelf.knex(table)
  return transacting ? q.transacting(transacting) : q
}

/** The positions of the other tasks in a column, top to bottom. */
async function columnRows (statusId, excludePostId, transacting) {
  return knexFor('groups_posts', transacting)
    .join('posts', 'posts.id', 'groups_posts.post_id')
    .where({ 'groups_posts.task_status_id': statusId, 'posts.active': true })
    .whereNot('groups_posts.post_id', excludePostId)
    .orderBy('groups_posts.task_position', 'asc')
    .orderBy('groups_posts.id', 'asc')
    .select('groups_posts.id', 'groups_posts.post_id', 'groups_posts.task_position')
}

/** Re-spaces a column's cards evenly, keeping their order. */
async function renumberColumn (statusId, excludePostId, transacting) {
  const rows = await columnRows(statusId, excludePostId, transacting)
  for (let i = 0; i < rows.length; i++) {
    await knexFor('groups_posts', transacting).where({ id: rows[i].id }).update({ task_position: (i + 1) * POSITION_GAP })
  }
}

/**
 * The position that puts a task at `index` among the other tasks of a column.
 * index null/undefined (or past the end) means the bottom; 0 means the top.
 */
export async function positionForIndex (statusId, postId, index, transacting) {
  let rows = await columnRows(statusId, postId, transacting)
  const at = index == null || index > rows.length ? rows.length : Math.max(0, index)
  const pos = row => Number(row.task_position) || 0

  if (rows.length === 0) return POSITION_GAP
  if (at === 0) return pos(rows[0]) - POSITION_GAP
  if (at === rows.length) return pos(rows[rows.length - 1]) + POSITION_GAP

  if (pos(rows[at]) - pos(rows[at - 1]) < MIN_GAP) {
    await renumberColumn(statusId, postId, transacting)
    rows = await columnRows(statusId, postId, transacting)
  }
  return (pos(rows[at - 1]) + pos(rows[at])) / 2
}

/** The post's board placements: one per group it is posted to. */
export async function placementsForPost (postId, { transacting } = {}) {
  const rows = await knexFor('groups_posts', transacting)
    .where({ post_id: postId })
    .orderBy('id', 'asc')
    .select('id', 'group_id', 'task_status_id', 'task_position')
  return rows.map(row => ({
    id: String(row.id),
    groupId: String(row.group_id),
    taskStatusId: row.task_status_id ? String(row.task_status_id) : null,
    position: row.task_position == null ? null : Number(row.task_position)
  }))
}

/**
 * Gives a task a column on every board it doesn't have one on yet (after create, or when
 * its groups change). It goes to the bottom of the first column matching its category.
 * `statusId`, when given, picks the starting column on that column's own board.
 */
export async function placeTaskOnBoards (post, { statusId, transacting } = {}) {
  const placements = await placementsForPost(post.id, { transacting })
  const requested = statusId ? await TaskStatus.find(statusId, { transacting }) : null
  let category = post.get('task_category')

  if (!category) {
    const requestedIsOnBoard = requested && placements.some(p => p.groupId === String(requested.get('group_id')))
    category = requestedIsOnBoard ? requested.get('category') : TaskStatus.Category.TODO
    const attrs = { task_category: category }
    if (category === TaskStatus.Category.DONE && !post.get('fulfilled_at')) attrs.fulfilled_at = new Date()
    await post.save(attrs, { patch: true, transacting })
  }

  for (const placement of placements) {
    if (placement.taskStatusId) continue
    const statuses = await TaskStatus.ensureForGroup(placement.groupId, { transacting })
    const column = (requested && String(requested.get('group_id')) === placement.groupId && requested) ||
      TaskStatus.firstOfCategory(statuses, category) ||
      statuses[0]
    const position = await positionForIndex(column.id, post.id, null, transacting)
    await knexFor('groups_posts', transacting).where({ id: placement.id }).update({
      task_status_id: column.id,
      task_position: position
    })
  }
}

/**
 * Sets the category shared by all of a task's boards. Entering "done" marks the post
 * fulfilled, leaving it clears that. Boards whose column is in a different category move
 * the task to their first column of the new one (top of the column for done, bottom
 * otherwise); a board with no such column is left alone.
 */
export async function syncTaskCategory (post, category, { exceptGroupId, transacting } = {}) {
  const previous = post.get('task_category')
  if (previous === category) return false

  const attrs = { task_category: category }
  if (category === TaskStatus.Category.DONE) {
    attrs.fulfilled_at = post.get('fulfilled_at') || new Date()
  } else if (previous === TaskStatus.Category.DONE || post.get('fulfilled_at')) {
    attrs.fulfilled_at = null
  }
  await post.save(attrs, { patch: true, transacting })

  const placements = await placementsForPost(post.id, { transacting })
  for (const placement of placements) {
    if (exceptGroupId && placement.groupId === String(exceptGroupId)) continue
    const statuses = await TaskStatus.ensureForGroup(placement.groupId, { transacting })
    const current = statuses.find(s => String(s.id) === placement.taskStatusId)
    if (current && current.get('category') === category) continue
    const target = TaskStatus.firstOfCategory(statuses, category)
    if (!target) continue
    const index = category === TaskStatus.Category.DONE ? 0 : null
    const position = await positionForIndex(target.id, post.id, index, transacting)
    await knexFor('groups_posts', transacting).where({ id: placement.id }).update({
      task_status_id: target.id,
      task_position: position
    })
  }
  return true
}

/**
 * Moves a task to a column (and a place within it) on one group's board, then brings
 * the task's other boards in line if the move changed its category.
 */
export async function moveTask ({ post, groupId, statusId, index, actorId }) {
  if (post.get('type') !== Post.Type.TASK) throw new GraphQLError('This post is not a task')

  return bookshelf.knex.transaction(async transacting => {
    const status = await TaskStatus.find(statusId, { transacting })
    if (!status || String(status.get('group_id')) !== String(groupId)) {
      throw new GraphQLError('That column is not on this board')
    }
    const placement = await knexFor('groups_posts', transacting).where({ post_id: post.id, group_id: groupId }).first()
    if (!placement) throw new GraphQLError('This task is not posted to that group')

    const fromStatus = placement.task_status_id ? await TaskStatus.find(placement.task_status_id, { transacting }) : null
    const position = await positionForIndex(status.id, post.id, index, transacting)
    await knexFor('groups_posts', transacting).where({ id: placement.id }).update({
      task_status_id: status.id,
      task_position: position
    })

    const changedColumn = !fromStatus || String(fromStatus.id) !== String(status.id)
    const previousCategory = post.get('task_category')
    const changedCategory = await syncTaskCategory(post, status.get('category'), { exceptGroupId: groupId, transacting })

    if (changedColumn) {
      await TaskEvent.log({
        postId: post.id,
        groupIds: [groupId],
        actorId,
        type: TaskEvent.Type.MOVED,
        meta: {
          fromStatusId: fromStatus ? String(fromStatus.id) : null,
          fromStatusName: fromStatus ? fromStatus.get('name') : null,
          toStatusId: String(status.id),
          toStatusName: status.get('name'),
          toCategory: status.get('category')
        }
      }, { transacting })
    }

    if (changedCategory) {
      const { DONE } = TaskStatus.Category
      const type = status.get('category') === DONE
        ? TaskEvent.Type.COMPLETED
        : previousCategory === DONE ? TaskEvent.Type.REOPENED : null
      if (type) {
        const placements = await placementsForPost(post.id, { transacting })
        await TaskEvent.log({ postId: post.id, groupIds: placements.map(p => p.groupId), actorId, type }, { transacting })
      }
    }

    return post
  })
}
