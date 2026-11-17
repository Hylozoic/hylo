import { boardProgress, dueInfo, isProjectSpace, locateTask, moveTaskOnBoard, toggleDoneTarget } from './boardState'

const task = id => ({ id: String(id), title: `Task ${id}` })
const board = () => [
  { id: 'todo', category: 'todo', tasksTotal: 3, tasks: [task(1), task(2), task(3)] },
  { id: 'doing', category: 'active', tasksTotal: 1, tasks: [task(4)] },
  { id: 'done', category: 'done', tasksTotal: 0, tasks: [] }
]
const ids = (columns, columnId) => columns.find(c => c.id === columnId).tasks.map(t => t.id)

describe('moveTaskOnBoard', () => {
  it('reorders within a column', () => {
    const next = moveTaskOnBoard(board(), '3', 'todo', 0)
    expect(ids(next, 'todo')).toEqual(['3', '1', '2'])
    expect(next[0].tasksTotal).toBe(3)
  })

  it('moves to an index in another column and updates both totals', () => {
    const next = moveTaskOnBoard(board(), '2', 'doing', 0)
    expect(ids(next, 'todo')).toEqual(['1', '3'])
    expect(ids(next, 'doing')).toEqual(['2', '4'])
    expect(next.map(c => c.tasksTotal)).toEqual([2, 2, 0])
  })

  it('puts the task at the bottom when no index is given or it is past the end', () => {
    expect(ids(moveTaskOnBoard(board(), '1', 'doing'), 'doing')).toEqual(['4', '1'])
    expect(ids(moveTaskOnBoard(board(), '1', 'doing', 99), 'doing')).toEqual(['4', '1'])
  })

  it('leaves the board alone for an unknown task or column', () => {
    const columns = board()
    expect(moveTaskOnBoard(columns, '99', 'doing', 0)).toBe(columns)
    expect(moveTaskOnBoard(columns, '1', 'nope', 0)).toBe(columns)
  })

  it('does not mutate the board it was given', () => {
    const columns = board()
    moveTaskOnBoard(columns, '1', 'done', 0)
    expect(ids(columns, 'todo')).toEqual(['1', '2', '3'])
  })
})

describe('locateTask', () => {
  it('finds a task\'s column and index', () => {
    expect(locateTask(board(), '2')).toEqual({ columnId: 'todo', index: 1 })
    expect(locateTask(board(), '99')).toBeNull()
  })
})

describe('boardProgress', () => {
  it('counts tasks in done columns, using totals so unloaded cards still count', () => {
    const columns = board()
    columns[2] = { ...columns[2], tasksTotal: 150, tasks: [task(9)] }
    expect(boardProgress(columns)).toEqual({ done: 150, total: 154 })
  })
})

describe('toggleDoneTarget', () => {
  it('sends an open task to the first done column and a done task back to the first column', () => {
    const columns = moveTaskOnBoard(board(), '4', 'done', 0)
    expect(toggleDoneTarget(columns, '1').id).toBe('done')
    expect(toggleDoneTarget(columns, '4').id).toBe('todo')
  })
})

describe('dueInfo', () => {
  const now = new Date(2026, 10, 17, 12)
  it('marks past dates late, the next three days soon, and later dates normal', () => {
    expect(dueInfo(new Date(2026, 10, 16, 9), { now }).tone).toBe('late')
    expect(dueInfo(new Date(2026, 10, 17, 23), { now })).toMatchObject({ tone: 'soon', days: 0 })
    expect(dueInfo(new Date(2026, 10, 20, 9), { now }).tone).toBe('soon')
    expect(dueInfo(new Date(2026, 10, 21, 9), { now }).tone).toBe('normal')
  })

  it('never marks a completed task late, and handles a missing date', () => {
    expect(dueInfo(new Date(2026, 10, 1), { now, done: true }).tone).toBe('normal')
    expect(dueInfo(null)).toBeNull()
  })
})

describe('isProjectSpace', () => {
  it('is a space whose home is its task board', () => {
    expect(isProjectSpace({ type: 'space', homeRoute: '/tasks' })).toBe(true)
    expect(isProjectSpace({ type: 'space', homeRoute: 'tasks' })).toBe(true)
    expect(isProjectSpace({ type: 'space', homeRoute: '/chat' })).toBe(false)
    expect(isProjectSpace({ type: 'group', homeRoute: '/tasks' })).toBe(false)
    expect(isProjectSpace(null)).toBe(false)
  })
})
