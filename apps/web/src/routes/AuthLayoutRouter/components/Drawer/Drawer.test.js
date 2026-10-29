import React from 'react'
import orm from 'store/models'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import Drawer, { ContextRow } from './Drawer'

const fooGroup = {
  id: '11',
  slug: 'foo',
  name: 'Foomunity',
  avatarUrl: '/foo.png',
  newPostCount: 0
}

const barGroup = {
  id: '22',
  slug: 'bar',
  name: 'Barmunity',
  avatarUrl: '/bar.png',
  newPostCount: 7
}

function currentUserWithGroupsProvider () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  const reduxState = { orm: ormSession.state }

  extractModelsForTest({
    me: {
      id: '1',
      name: 'Test User',
      hasRegistered: true,
      emailValidated: true,
      settings: {
        signupInProgress: false
      },
      memberships: [
        {
          id: '2',
          person: {
            id: '1'
          },
          newPostCount: 0,
          group: fooGroup
        },
        {
          id: '3',
          person: {
            id: '1'
          },
          newPostCount: 7,
          group: barGroup
        }
      ]
    }
  }, 'Me', ormSession)

  return AllTheProviders(reduxState)
}

const match = {
  match: {
    params: {
      context: 'groups',
      groupSlug: 'slug'
    }
  }
}

it('shows groups for current user', () => {
  render(
    <Drawer match={match} />,
    { wrapper: currentUserWithGroupsProvider() }
  )

  expect(screen.getByText(fooGroup.name)).toBeInTheDocument()
  expect(screen.getByText(barGroup.name)).toBeInTheDocument()
})

describe('ContextRow', () => {
  it('renders with zero new posts', () => {
    render(<ContextRow group={fooGroup} />)

    expect(screen.getByText(fooGroup.name)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument() // Assuming Badge is rendered with role="status"
  })

  it('renders with new posts', () => {
    render(<ContextRow group={barGroup} />)

    expect(screen.getByText(barGroup.name)).toBeInTheDocument()
    // Badge intentionally shows a presence indicator ('-'), not the raw count
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('Group Settings link', () => {
  const group = {
    id: '11',
    slug: 'foo',
    name: 'Foomunity',
    myInviteAccess: 'limited'
  }

  function providersWithRoles (roles) {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create(group)
    ormSession.Me.create({ id: '1', name: 'Test User', groupRoles: { items: roles } })
    return AllTheProviders({ orm: ormSession.state })
  }

  it('is not shown to a member whose only invite access comes from the Member role', () => {
    render(<Drawer group={group} />, { wrapper: providersWithRoles([]) })

    expect(screen.queryByText('Group Settings')).not.toBeInTheDocument()
  })

  it('is shown to someone with an assigned role that can add members', () => {
    const host = { id: '3', groupId: '11', name: 'Host', responsibilities: { items: [{ id: '2', title: 'Add Members' }] } }
    render(<Drawer group={group} />, { wrapper: providersWithRoles([host]) })

    expect(screen.getByText('Group Settings')).toBeInTheDocument()
  })

  it('is shown to Administrators', () => {
    const administrator = {
      id: '1',
      groupId: '11',
      name: 'Administrator',
      responsibilities: { items: ['Administration', 'Add Members', 'Remove Members', 'Manage Content'].map((title, i) => ({ id: String(i + 1), title })) }
    }
    render(<Drawer group={group} />, { wrapper: providersWithRoles([administrator]) })

    expect(screen.getByText('Group Settings')).toBeInTheDocument()
  })

  it('is not shown for a role whose only responsibility is Invite Members, or another that cannot open Group Settings', () => {
    const inviter = { id: '5', groupId: '11', name: 'Greeter', responsibilities: { items: [{ id: '41', title: 'Invite Members' }] } }
    const custom = { id: '6', groupId: '11', name: 'Gardener', responsibilities: { items: [{ id: '70', title: 'Water the plants' }] } }
    render(<Drawer group={group} />, { wrapper: providersWithRoles([inviter, custom]) })

    expect(screen.queryByText('Group Settings')).not.toBeInTheDocument()
  })

  it('is not shown to Moderators', () => {
    const moderator = { id: '2', groupId: '11', name: 'Moderator', responsibilities: { items: [{ id: '3', title: 'Remove Members' }, { id: '4', title: 'Manage Content' }] } }
    render(<Drawer group={group} />, { wrapper: providersWithRoles([moderator]) })

    expect(screen.queryByText('Group Settings')).not.toBeInTheDocument()
  })
})
