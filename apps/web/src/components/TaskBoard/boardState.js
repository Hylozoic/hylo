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
  // A moved card takes a place among the loaded cards, so it is no longer one added below them
  const { addedBelow, ...task } = from.tasks.find(t => t.id === taskId)
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

/**
 * How many of a column's cards come from its loaded pages, i.e. the offset of the next page.
 * Cards added while the column wasn't fully loaded sit at the very bottom on the server, after
 * the cards not loaded yet, so they are left out (they carry `addedBelow`).
 */
export function columnPageOffset (column) {
  return column.tasks.filter(task => !task.addedBelow).length
}

/**
 * Returns the columns with the next page of one column's cards added after its loaded ones
 * (and before any it added below them). Cards already on the column are not repeated.
 */
export function appendColumnPage (columns, columnId, { tasks = [], tasksTotal } = {}) {
  return columns.map(column => {
    if (column.id !== columnId) return column
    const loaded = column.tasks.filter(task => !task.addedBelow)
    const below = column.tasks.filter(task => task.addedBelow)
    const known = new Set(column.tasks.map(task => task.id))
    const fresh = tasks.filter(task => !known.has(task.id))
    return {
      ...column,
      tasks: [...loaded, ...fresh, ...below],
      tasksTotal: tasksTotal ?? column.tasksTotal
    }
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
