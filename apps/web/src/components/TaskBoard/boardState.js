// Pure helpers for the kanban board's local state: an array of columns
// ({ id, name, category, order, tasksTotal, tasks: [...] }) in board order.

/** The column holding a task, or undefined. */
export function columnOfTask (columns, taskId) {
  return columns.find(column => column.tasks.some(task => task.id === taskId))
}

/** Where a task is: { columnId, index }, or null when it isn't on the board. */
export function locateTask (columns, taskId) {
  const column = columnOfTask(columns, taskId)
  if (!column) return null
  return { columnId: column.id, index: column.tasks.findIndex(task => task.id === taskId) }
}

/**
 * Returns the columns with a task moved to `toIndex` of `toColumnId`
 * (index counted among the column's other tasks; past the end means the bottom).
 * Totals follow the task. Unknown tasks or columns leave the board unchanged.
 */
export function moveTaskOnBoard (columns, taskId, toColumnId, toIndex) {
  const from = columnOfTask(columns, taskId)
  const to = columns.find(column => column.id === toColumnId)
  if (!from || !to) return columns
  const task = from.tasks.find(t => t.id === taskId)
  const sameColumn = from.id === to.id

  return columns.map(column => {
    if (column.id !== from.id && column.id !== to.id) return column
    let tasks = column.tasks
    let tasksTotal = column.tasksTotal
    if (column.id === from.id) {
      tasks = tasks.filter(t => t.id !== taskId)
      if (!sameColumn) tasksTotal = Math.max(0, (tasksTotal || 0) - 1)
    }
    if (column.id === to.id) {
      const at = toIndex == null ? tasks.length : Math.max(0, Math.min(toIndex, tasks.length))
      tasks = [...tasks.slice(0, at), task, ...tasks.slice(at)]
      if (!sameColumn) tasksTotal = (tasksTotal || 0) + 1
    }
    return { ...column, tasks, tasksTotal }
  })
}

/** { done, total } across the board, counting tasks in "done" columns as done. */
export function boardProgress (columns) {
  let done = 0
  let total = 0
  for (const column of columns) {
    const count = column.tasksTotal ?? column.tasks.length
    total += count
    if (column.category === 'done') done += count
  }
  return { done, total }
}

/** The column a task goes to when its check circle is clicked: the first done column, or back to the first column. */
export function toggleDoneTarget (columns, taskId) {
  const current = columnOfTask(columns, taskId)
  if (!current) return null
  if (current.category === 'done') return columns.find(column => column.category !== 'done') || null
  return columns.find(column => column.category === 'done') || null
}

/**
 * How a due date should read on a card: { label, tone } where tone is 'late', 'soon' or 'normal'.
 * Completed tasks are never late.
 */
export function dueInfo (endTime, { done = false, now = new Date(), locale } = {}) {
  if (!endTime) return null
  const due = new Date(endTime)
  if (isNaN(due.getTime())) return null
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86400000)
  const label = due.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  if (done) return { label, tone: 'normal', days }
  if (days < 0) return { label, tone: 'late', days }
  if (days <= 3) return { label, tone: 'soon', days }
  return { label, tone: 'normal', days }
}

/** A project space is a space that opens on its task board. */
export function isProjectSpace (group) {
  return group?.type === 'space' && /(^|\/)tasks$/.test(group.homeRoute || '')
}
