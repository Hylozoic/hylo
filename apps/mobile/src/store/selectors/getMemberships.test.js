import orm from '../models'
import getMemberships from './getMemberships'

it('gets all groups on current user', () => {
  const session = orm.mutableSession(orm.getEmptyState())
  const meId = 'meId'
  const group1Id = 'group1Id'
  const group2Id = 'group2Id'
  const membership1Id = 'membership1Id'
  const membership2Id = 'membership2Id'

  const me = session.Me.create({ id: meId })
  session.Group.create({ id: group1Id, name: 'group 1' })
  session.Group.create({ id: group2Id, name: 'group 2' })
  session.Membership.create({ id: membership1Id, group: group1Id, person: meId })
  session.Membership.create({ id: membership2Id, group: group2Id, person: meId })
  me.updateAppending({ memberships: [membership1Id, membership2Id] })

  const state = { orm: session.state }

  expect(getMemberships(state)).toMatchSnapshot()
})
