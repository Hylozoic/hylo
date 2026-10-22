import { materializeLocalTime, sid } from './helpers'

describe('sandbox sid()', () => {
  it('returns numeric ids', () => {
    expect(sid('post', '001')).toMatch(/^\d+$/)
    expect(sid('person', '008')).toMatch(/^\d+$/)
  })

  it('does not collide stream posts with chat or funding posts', () => {
    const stream = sid('post', '001')
    const chat = sid('post', 'chat-001')
    const simple = sid('post', 'simple-001')
    const funding = sid('post', 'fr-001')

    expect(new Set([stream, chat, simple, funding]).size).toBe(4)
  })

  it('treats hyphenated and split parts the same when not a compound token', () => {
    expect(sid('post', 'chat-001')).toBe(sid('post', 'chat', '001'))
  })

  it('pins a local clock time onto one Pacific calendar day', () => {
    const iso = materializeLocalTime({ days: 1, hour: 10, minute: 30 }, Date.UTC(2026, 9, 20, 22, 0, 0))
    expect(iso).toBe('2026-10-21T17:30:00.000Z')
  })

  it('keeps compound view tokens unique (staff-chat vs staff-events)', () => {
    const staffViews = [
      'staff-chat',
      'staff-all',
      'staff-requests',
      'staff-events',
      'staff-members'
    ].map(name => sid('view', name))
    const simpleViews = [
      'simple-chat',
      'simple-all',
      'simple-map',
      'simple-events',
      'simple-requests',
      'simple-projects',
      'simple-members'
    ].map(name => sid('view', name))

    expect(new Set(staffViews).size).toBe(staffViews.length)
    expect(new Set(simpleViews).size).toBe(simpleViews.length)
    expect(sid('view', 'staff-chat')).not.toBe(sid('view', 'staff-events'))
  })
})
