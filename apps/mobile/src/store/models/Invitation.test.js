import orm from './index' // this initializes redux-orm

it('can be created', () => {
  const invitation = { id: '1' }
  const session = orm.session(orm.getEmptyState())
  session.Invitation.create(invitation)

  const { Invitation: { items, itemsById } } = session.state
  expect(items).toEqual([invitation.id])
  expect(itemsById[invitation.id]).toEqual(invitation)
})
