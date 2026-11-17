import summarizeTaskEvents, { eventsFromToday } from './summarizeTaskEvents'

const ana = { id: '1', name: 'Ana' }
const ben = { id: '2', name: 'Ben' }
const task = (id, title = `Task ${id}`) => ({ id: String(id), title })
const ev = (type, actor, post, meta = {}, createdAt = '2026-11-17T10:00:00Z') => ({ type, actor, post, meta, createdAt })

describe('summarizeTaskEvents', () => {
  it('reports a task that ended up done as completed, once', () => {
    const { lines, tally } = summarizeTaskEvents([
      ev('moved', ana, task(1), { toStatusName: 'In progress', toCategory: 'active' }),
      ev('moved', ben, task(1), { toStatusName: 'Complete', toCategory: 'done' }),
      ev('completed', ben, task(1))
    ])
    expect(lines).toEqual([{ kind: 'completed', actor: ben, task: task(1) }])
    expect(tally).toEqual({ done: 1, added: 0 })
  })

  it('does not count a task that was completed and then reopened', () => {
    const { lines, tally } = summarizeTaskEvents([
      ev('completed', ana, task(1)),
      ev('reopened', ana, task(1)),
      ev('moved', ana, task(1), { toStatusName: 'To do', toCategory: 'todo' })
    ])
    expect(lines).toEqual([{ kind: 'moved', actor: ana, task: task(1), to: 'To do' }])
    expect(tally.done).toBe(0)
  })

  it('groups the tasks each person added into one line', () => {
    const { lines, tally } = summarizeTaskEvents([
      ev('created', ana, task(1)),
      ev('created', ana, task(2)),
      ev('created', ben, task(3))
    ])
    expect(lines).toEqual([
      { kind: 'added', actor: ana, tasks: [task(1), task(2)] },
      { kind: 'added', actor: ben, tasks: [task(3)] }
    ])
    expect(tally.added).toBe(3)
  })

  it('tells taking a task apart from being assigned by someone else', () => {
    const { lines } = summarizeTaskEvents([
      ev('assigned', ana, task(1), { userId: '1', userName: 'Ana' }),
      ev('assigned', ana, task(2), { userId: '2', userName: 'Ben' })
    ])
    expect(lines).toEqual([
      { kind: 'took', actor: ana, task: task(1) },
      { kind: 'assigned', actor: ana, task: task(2), to: 'Ben' }
    ])
  })

  it('drops an assignment that was undone the same day', () => {
    const { lines } = summarizeTaskEvents([
      ev('assigned', ana, task(1), { userId: '1' }),
      ev('unassigned', ana, task(1), { userId: '1' })
    ])
    expect(lines).toEqual([])
  })

  it('orders lines completed, added, assigned, moved and lists who was active', () => {
    const { lines, people, lastAt } = summarizeTaskEvents([
      ev('moved', ana, task(1), { toStatusName: 'In progress', toCategory: 'active' }),
      ev('assigned', ben, task(2), { userId: '2' }),
      ev('created', ana, task(3)),
      ev('completed', ben, task(4), {}, '2026-11-17T12:00:00Z')
    ])
    expect(lines.map(l => l.kind)).toEqual(['completed', 'added', 'took', 'moved'])
    expect(people).toEqual([ana, ben])
    expect(lastAt).toBe('2026-11-17T12:00:00Z')
  })
})

describe('eventsFromToday', () => {
  it('keeps only events from the current local day', () => {
    const now = new Date(2026, 10, 17, 15, 0, 0)
    const today = ev('created', ana, task(1), {}, new Date(2026, 10, 17, 8, 0, 0).toISOString())
    const yesterday = ev('created', ana, task(2), {}, new Date(2026, 10, 16, 23, 0, 0).toISOString())
    expect(eventsFromToday([yesterday, today], now)).toEqual([today])
  })
})
