import getCurrentUserId from './getCurrentUserId'
import orm from '../models'

it('gets the correct id', () => {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '55' })
  expect(getCurrentUserId({ orm: session.state })).toBe('55')
})
