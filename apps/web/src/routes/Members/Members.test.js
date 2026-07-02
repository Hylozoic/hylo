function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({
    id: '1',
    name: 'You',
    memberships: [ormSession.Membership.create({
      id: '1',
      group: '1'
    })]
  })
  ormSession.Group.create({
    id: '1',
    slug: 'goteam',
    name: 'Go Team',
    memberCount: 3,
    members: [
      { id: '1', name: 'You', groupRoles: { items: [] } },
      { id: '2', name: 'Me', groupRoles: { items: [] } },
      { id: '3', name: 'Everyone', groupRoles: { items: [] } }
    ]
  })

  const reduxState = { orm: ormSession.state, pending: {} }

  return AllTheProviders(reduxState)
}