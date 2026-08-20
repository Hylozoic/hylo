import { sid } from './helpers'

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

  it('treats hyphenated and split parts the same', () => {
    expect(sid('post', 'chat-001')).toBe(sid('post', 'chat', '001'))
  })
})
