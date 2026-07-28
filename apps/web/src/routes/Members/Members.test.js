import React from 'react'
import orm from 'store/models'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import Members from './Members'

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

describe('Members', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <Members
        group={{ id: '1', slug: 'goteam', name: 'Go Team' }}
        members={[]}
        fetchMembers={jest.fn(() => Promise.resolve({ payload: { data: {} } }))}
        fetchMemberSuggestions={jest.fn(() => Promise.resolve({ payload: { data: {} } }))}
        canModerate
      />,
      null,
      testProviders()
    )

    expect(container.querySelector('#root') || container).toBeTruthy()
  })
})
