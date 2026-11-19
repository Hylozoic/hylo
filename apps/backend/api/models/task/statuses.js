import { GraphQLError } from 'graphql'
import { POSITION_GAP, syncTaskCategory } from './placement'

// Managing the columns of a board: add, rename, re-categorise, reorder and delete.
// A board always keeps at least one "done" column so completion has somewhere to land.

const cleanName = name => {
  const trimmed = (name || '').trim()
  if (!trimmed) throw new GraphQLError('A column needs a name')
  return trimmed.slice(0, 80)
}

const assertCategory = category => {
  if (!TaskStatus.CATEGORIES.includes(category)) throw new GraphQLError('Not a valid column category')
}

/** Rewrites `order` so the given columns are numbered 0..n in this sequence. */
async function saveOrder (statuses, transacting) {
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i].get('order') !== i) await statuses[i].save({ order: i }, { patch: true, transacting })
  }
}

const isLastDoneColumn = (statuses, status) =>
  status.get('category') === TaskStatus.Category.DONE &&
  statuses.filter(s => s.get('category') === TaskStatus.Category.DONE).length === 1

/** The active tasks sitting in a column, top to bottom. */
function tasksInColumn (statusId, transacting) {
  return bookshelf.knex('groups_posts').transacting(transacting)
    .join('posts', 'posts.id', 'groups_posts.post_id')
    .where({ 'groups_posts.task_status_id': statusId, 'posts.active': true })
    .orderBy('groups_posts.task_position', 'asc')
    .select('groups_posts.id', 'groups_posts.post_id')
}

/** Applies a column's (new) category to every task in it, and to those tasks' other boards. */
async function syncColumnTasks (status, transacting) {
  const rows = await tasksInColumn(status.id, transacting)
  for (const row of rows) {
    const post = await Post.find(row.post_id, { transacting })
    if (post) await syncTaskCategory(post, status.get('category'), { exceptGroupId: status.get('group_id'), transacting })
  }
}

/** Adds a column. By default it is an "in progress" column placed just before the first done column. */
export function createTaskStatus ({ groupId, name, category = TaskStatus.Category.ACTIVE }) {
  assertCategory(category)
  return bookshelf.knex.transaction(async transacting => {
    const statuses = await TaskStatus.ensureForGroup(groupId, { transacting })
    const status = await TaskStatus.forge({ group_id: groupId, name: cleanName(name), category, order: statuses.length })
      .save(null, { transacting })
    const firstDone = statuses.findIndex(s => s.get('category') === TaskStatus.Category.DONE)
    const at = category === TaskStatus.Category.DONE || firstDone < 0 ? statuses.length : firstDone
    const ordered = [...statuses.slice(0, at), status, ...statuses.slice(at)]
    await saveOrder(ordered, transacting)
    return status
  })
}

/** Renames, re-categorises and/or moves a column. `order` is the column's new index on the board. */
export function updateTaskStatus ({ id, name, category, order }) {
  return bookshelf.knex.transaction(async transacting => {
    const status = await TaskStatus.find(id, { transacting })
    if (!status) throw new GraphQLError('Column not found')
    const statuses = await TaskStatus.forGroup(status.get('group_id'), { transacting })
    const attrs = {}

    if (name != null) attrs.name = cleanName(name)

    if (category != null && category !== status.get('category')) {
      assertCategory(category)
      if (isLastDoneColumn(statuses, status)) {
        throw new GraphQLError('A board needs at least one column for completed tasks')
      }
      attrs.category = category
    }

    if (Object.keys(attrs).length > 0) await status.save(attrs, { patch: true, transacting })
    if (attrs.category) await syncColumnTasks(status, transacting)

    if (order != null) {
      const others = statuses.filter(s => String(s.id) !== String(status.id))
      const at = Math.max(0, Math.min(order, others.length))
      await saveOrder([...others.slice(0, at), status, ...others.slice(at)], transacting)
    }

    return status
  })
}

/**
 * Deletes a column. Its tasks move to the bottom of the board's first remaining column,
 * keeping their order, and take that column's category.
 */
export function deleteTaskStatus ({ id }) {
  return bookshelf.knex.transaction(async transacting => {
    const status = await TaskStatus.find(id, { transacting })
    if (!status) throw new GraphQLError('Column not found')
    const statuses = await TaskStatus.forGroup(status.get('group_id'), { transacting })
    if (statuses.length <= 1) throw new GraphQLError('A board needs at least one column')
    if (isLastDoneColumn(statuses, status)) {
      throw new GraphQLError('A board needs at least one column for completed tasks')
    }

    const remaining = statuses.filter(s => String(s.id) !== String(status.id))
    const fallback = remaining[0]
    const rows = await tasksInColumn(status.id, transacting)
    const last = await bookshelf.knex('groups_posts').transacting(transacting)
      .where({ task_status_id: fallback.id }).max('task_position as max').first()
    let position = Number(last?.max) || 0

    for (const row of rows) {
      position += POSITION_GAP
      await bookshelf.knex('groups_posts').transacting(transacting).where({ id: row.id })
        .update({ task_status_id: fallback.id, task_position: position })
    }

    await status.destroy({ transacting })
    await saveOrder(remaining, transacting)
    await syncColumnTasks(fallback, transacting)
    return { success: true }
  })
}
