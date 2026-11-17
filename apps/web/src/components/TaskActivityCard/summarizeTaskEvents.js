/**
 * Collapses a day of task events on one board into a short story for the daily summary card.
 * Several events on the same task become one line: a task that was moved twice and ended in
 * a done column reads as "completed", not as two moves.
 *
 * @param {Array} events - TaskEvents (type, createdAt, meta, actor { id, name }, post { id, title }), oldest first
 * @returns {{ lines: Array, tally: { done: number, added: number }, people: Array, lastAt: string|null }}
 *   Each line is { kind, actor, task } or, for 'added', { kind, actor, tasks }.
 *   kind: 'completed' | 'added' | 'took' | 'assigned' | 'moved' (assigned and moved also carry `to`).
 */
export default function summarizeTaskEvents (events = []) {
  const perTask = new Map()
  const people = []

  for (const event of events) {
    if (!event?.post?.id) continue
    if (event.actor && !people.some(p => p.id === event.actor.id)) people.push(event.actor)
    let s = perTask.get(event.post.id)
    if (!s) {
      s = { task: event.post, createdBy: null, completedBy: null, lastMove: null, lastAssign: null }
      perTask.set(event.post.id, s)
    }
    const meta = event.meta || {}
    switch (event.type) {
      case 'created':
        s.createdBy = event.actor
        break
      case 'completed':
        s.completedBy = event.actor
        break
      case 'reopened':
        s.completedBy = null
        break
      case 'moved':
        s.lastMove = { actor: event.actor, to: meta.toStatusName, category: meta.toCategory }
        break
      case 'assigned':
        s.lastAssign = { actor: event.actor, userId: meta.userId, userName: meta.userName }
        break
      case 'unassigned':
        if (s.lastAssign && String(s.lastAssign.userId) === String(meta.userId)) s.lastAssign = null
        break
    }
  }

  const completed = []
  const assigned = []
  const moved = []
  const addedByActor = new Map()

  for (const s of perTask.values()) {
    if (s.completedBy) {
      completed.push({ kind: 'completed', actor: s.completedBy, task: s.task })
    } else if (s.createdBy) {
      const key = s.createdBy.id
      if (!addedByActor.has(key)) addedByActor.set(key, { kind: 'added', actor: s.createdBy, tasks: [] })
      addedByActor.get(key).tasks.push(s.task)
    } else if (s.lastAssign) {
      const self = String(s.lastAssign.userId) === String(s.lastAssign.actor?.id)
      assigned.push(self
        ? { kind: 'took', actor: s.lastAssign.actor, task: s.task }
        : { kind: 'assigned', actor: s.lastAssign.actor, task: s.task, to: s.lastAssign.userName })
    } else if (s.lastMove && s.lastMove.category !== 'done') {
      moved.push({ kind: 'moved', actor: s.lastMove.actor, task: s.task, to: s.lastMove.to })
    }
  }

  const added = [...addedByActor.values()]
  return {
    lines: [...completed, ...added, ...assigned, ...moved],
    tally: {
      done: completed.length,
      added: added.reduce((n, line) => n + line.tasks.length, 0)
    },
    people,
    lastAt: events.length > 0 ? events[events.length - 1].createdAt : null
  }
}

/** The events that happened on the viewer's current calendar day. */
export function eventsFromToday (events = [], now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return events.filter(event => new Date(event.createdAt).getTime() >= start)
}
