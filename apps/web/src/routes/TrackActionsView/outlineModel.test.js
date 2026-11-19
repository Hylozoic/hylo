import {
  applyOutlineInput,
  buildOutline,
  currentAction,
  moduleLock,
  moveOutlineItem,
  outlineProgress,
  outlineToInput
} from './outlineModel'

const post = (id, done) => ({ id: String(id), title: `Post ${id}`, completedAt: done ? '2026-01-01T00:00:00.000Z' : null })
const trackModule = (id, index, postIds, extra = {}) => ({ id: String(id), title: `Module ${id}`, index, postIds: postIds.map(String), ...extra })

/** Outline as readable strings, e.g. ['1', 'm10[2,3]']. */
const shape = items => items.map(item => item.kind === 'module' ? `m${item.id}[${item.posts.map(p => p.id).join(',')}]` : item.id)

describe('outlineModel', () => {
  // Flat order of the whole track: 1, then module 10 (2, 3), then an empty module 11, then 4
  const posts = [post(1, true), post(2, true), post(3), post(4)]
  const modules = [trackModule(10, 1, [2, 3]), trackModule(11, 2, [])]
  const items = buildOutline(posts, modules)

  describe('buildOutline', () => {
    it('places modules at their index among the top-level actions', () => {
      expect(shape(items)).toEqual(['1', 'm10[2,3]', 'm11[]', '4'])
    })

    it('is a flat list of actions when the track has no modules', () => {
      expect(shape(buildOutline(posts, undefined))).toEqual(['1', '2', '3', '4'])
    })

    it('copes with an index past the end and with posts it does not have', () => {
      expect(shape(buildOutline([post(1)], [trackModule(10, 9, [7])]))).toEqual(['1', 'm10[]'])
    })
  })

  it('counts progress across every action, wherever it sits', () => {
    expect(outlineProgress(items)).toEqual({ done: 2, total: 4 })
  })

  describe('moduleLock and currentAction', () => {
    const now = new Date('2026-06-01T00:00:00.000Z')

    it('picks the first incomplete action', () => {
      expect(currentAction(items, now).post.id).toEqual('3')
    })

    it('locks a module until its opening date, and skips its actions', () => {
      const dated = buildOutline(posts, [trackModule(10, 1, [2, 3], { opensAt: '2026-07-01T00:00:00.000Z' })])
      expect(moduleLock(dated, dated[1], now)).toMatchObject({ locked: true, reason: 'date' })
      expect(currentAction(dated, now).post.id).toEqual('4')
      expect(moduleLock(dated, dated[1], new Date('2026-07-02T00:00:00.000Z')).locked).toBe(false)
    })

    it('locks a module that opens after the previous one until that one is finished', () => {
      const sequenced = buildOutline(
        [post(1, true), post(2), post(3)],
        [trackModule(10, 0, [1, 2]), trackModule(11, 1, [3], { opensAfterPrevious: true })]
      )
      expect(moduleLock(sequenced, sequenced[1], now)).toEqual({ locked: true, reason: 'previous', previousNumber: 1 })
      const finished = buildOutline(
        [post(1, true), post(2, true), post(3)],
        [trackModule(10, 0, [1, 2]), trackModule(11, 1, [3], { opensAfterPrevious: true })]
      )
      expect(moduleLock(finished, finished[1], now).locked).toBe(false)
    })
  })

  describe('moveOutlineItem', () => {
    const move = (dragged, target) => shape(moveOutlineItem(items, dragged, target))

    it('reorders top-level actions', () => {
      expect(move({ kind: 'action', id: '4' }, { type: 'action', id: '1' })).toEqual(['4', '1', 'm10[2,3]', 'm11[]'])
    })

    it('moves an action into a module, before the action it was dropped on', () => {
      expect(move({ kind: 'action', id: '4' }, { type: 'action', id: '3' })).toEqual(['1', 'm10[2,4,3]', 'm11[]'])
    })

    it('moves an action to the end of a module from its header or its end zone', () => {
      expect(move({ kind: 'action', id: '1' }, { type: 'module', id: '11' })).toEqual(['m10[2,3]', 'm11[1]', '4'])
      expect(move({ kind: 'action', id: '2' }, { type: 'module-end', id: '11' })).toEqual(['1', 'm10[3]', 'm11[2]', '4'])
    })

    it('moves an action out of a module', () => {
      expect(move({ kind: 'action', id: '2' }, { type: 'action', id: '4' })).toEqual(['1', 'm10[3]', 'm11[]', '2', '4'])
      expect(move({ kind: 'action', id: '2' }, { type: 'end' })).toEqual(['1', 'm10[3]', 'm11[]', '4', '2'])
    })

    it('moves a module, and never puts it inside another module', () => {
      expect(move({ kind: 'module', id: '11' }, { type: 'action', id: '1' })).toEqual(['m11[]', '1', 'm10[2,3]', '4'])
      expect(move({ kind: 'module', id: '11' }, { type: 'action', id: '3' })).toEqual(['1', 'm11[]', 'm10[2,3]', '4'])
      expect(move({ kind: 'module', id: '10' }, { type: 'end' })).toEqual(['1', 'm11[]', '4', 'm10[2,3]'])
      expect(move({ kind: 'module', id: '10' }, { type: 'module-end', id: '11' })).toEqual(shape(items))
    })

    it('returns the same outline when nothing moves', () => {
      expect(moveOutlineItem(items, { kind: 'action', id: '1' }, { type: 'action', id: '1' })).toBe(items)
      expect(moveOutlineItem(items, { kind: 'module', id: '10' }, { type: 'module', id: '10' })).toBe(items)
    })
  })

  it('round-trips through the mutation input', () => {
    const moved = moveOutlineItem(items, { kind: 'action', id: '4' }, { type: 'module', id: '11' })
    const fields = applyOutlineInput(posts, modules, outlineToInput(moved))
    expect(fields.collectionPosts.map(p => p.id)).toEqual(['1', '2', '3', '4'])
    expect(shape(buildOutline(fields.collectionPosts, fields.trackModules))).toEqual(['1', 'm10[2,3]', 'm11[4]'])
  })
})
