import getCurrentGroupSlug from './getCurrentGroupSlug'
import orm from '../models'

describe('getCurrentGroupSlug', () => {
  let session
  beforeEach(() => {
    session = orm.session(orm.getEmptyState())
  })

  it('gets slug from state', () => {
    const state = {
      orm: session.state,
      session: {
        groupSlug: 'test-group'
      }
    }
    const groupSlug = getCurrentGroupSlug(state)
    expect(groupSlug).toBe('test-group')
  })
})
