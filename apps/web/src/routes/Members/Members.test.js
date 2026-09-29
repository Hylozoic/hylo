import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, AllTheProviders, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import Members from './Members'

let mockGroupSlug
jest.mock('contexts/SpaceGroupContext', () => ({
  ...jest.requireActual('contexts/SpaceGroupContext'),
  useEffectiveGroupSlug: () => mockGroupSlug
}))

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

describe('Members header Invite pill', () => {
  function HeaderActions () {
    const { headerDetails } = useViewHeader()
    return headerDetails.headerActions || null
  }

  function providers ({ myInviteAccess, roles = [] }) {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create({ id: '1', slug: 'goteam', name: 'Go Team', memberCount: 3, myInviteAccess })
    ormSession.Me.create({
      id: '1',
      name: 'You',
      groupRoles: { items: roles },
      memberships: [ormSession.Membership.create({ id: '1', group: '1' })]
    })
    return AllTheProviders({ orm: ormSession.state, pending: {} })
  }

  function renderMembers (options) {
    return render(<><Members /><HeaderActions /></>, null, providers(options))
  }

  beforeEach(() => { mockGroupSlug = 'goteam' })
  afterEach(() => { mockGroupSlug = undefined })

  it('shows for a member with limited invite access', () => {
    renderMembers({ myInviteAccess: 'limited' })

    expect(screen.getByRole('button', { name: 'Invite Members' })).toBeInTheDocument()
  })

  it('shows for someone who can add members', () => {
    const host = { id: '5', groupId: '1', name: 'Host', responsibilities: { items: [{ id: '2', title: 'Add Members' }] } }
    renderMembers({ myInviteAccess: 'full', roles: [host] })

    expect(screen.getByRole('button', { name: 'Invite Members' })).toBeInTheDocument()
  })

  it('is hidden for a member when only stewards can invite', () => {
    renderMembers({ myInviteAccess: null })

    expect(screen.queryByRole('button', { name: 'Invite Members' })).not.toBeInTheDocument()
  })
})

describe('Members removal refused by the server', () => {
  const stewardRole = { id: '6', groupId: '1', name: 'Moderator', responsibilities: { items: [{ id: '3', title: 'Remove Members' }] } }
  const soleAdministrator = { id: '2', name: 'Ada Admin', avatarUrl: '', groupRoles: { items: [] }, skills: { items: [] } }

  function providers () {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create({ id: '1', slug: 'goteam', name: 'Go Team', memberCount: 2 })
    ormSession.Me.create({
      id: '1',
      name: 'You',
      groupRoles: { items: [stewardRole] },
      memberships: [ormSession.Membership.create({ id: '1', group: '1' })]
    })
    return AllTheProviders({ orm: ormSession.state, pending: {} })
  }

  beforeEach(() => { mockGroupSlug = 'goteam' })
  afterEach(() => { mockGroupSlug = undefined })

  it('says why and lists the person again when the only Administrator cannot be removed', async () => {
    let memberFetches = 0
    mockGraphqlServer.use(
      graphql.operation(({ query }) => {
        if (query.includes('removeMember')) {
          return HttpResponse.json({ errors: [{ message: 'A group must keep at least one Administrator' }], data: { removeMember: null } })
        }
        if (query.includes('FetchGroupMembers')) {
          memberFetches += 1
          return HttpResponse.json({
            data: {
              group: {
                id: '1',
                name: 'Go Team',
                avatarUrl: '',
                memberCount: 2,
                groupRoles: { items: [] },
                members: { items: [soleAdministrator], hasMore: false, total: 1 }
              }
            }
          })
        }
        return HttpResponse.json({ data: {} })
      })
    )
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {})

    render(<Members />, null, providers())

    expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
    // The member card's menu comes after the page's sort menu
    const menus = screen.getAllByTestId('dropdown-toggle')
    fireEvent.click(menus[menus.length - 1])
    fireEvent.click(await screen.findByText('Remove member from group'))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(alert).toHaveBeenCalledWith('A group must keep at least one Administrator'))
    await waitFor(() => expect(memberFetches).toBeGreaterThan(1))
    expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
    alert.mockRestore()
  })
})
