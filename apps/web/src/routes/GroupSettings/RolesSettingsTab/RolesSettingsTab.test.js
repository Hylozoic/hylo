import React from 'react'
import { graphql, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { AllTheProviders, fireEvent, render, screen, waitFor, within } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import RolesSettingsTab, { AddMemberToRole, RoleList } from './RolesSettingsTab'

describe('RolesSettingsTab', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <RolesSettingsTab group={{ id: 1, slug: 'test-group', groupRoles: { items: [] } }} slug='test-group' />,
      { wrapper: AllTheProviders() }
    )
    expect(container.querySelector('#root') || container).toBeTruthy()
  })

  it('displays system roles before custom roles in the correct order', () => {
    const group = {
      id: 1,
      slug: 'test-group',
      groupRoles: {
        items: [
          { id: 100, name: 'Custom B', type: 'custom', active: true, emoji: '⭐', description: '' },
          { id: 50, name: 'Host', type: 'system', active: true, emoji: '👋', description: '' },
          { id: 30, name: 'Administrator', type: 'system', active: true, emoji: '🪄', description: '' },
          { id: 40, name: 'Moderator', type: 'system', active: true, emoji: '⚖️', description: '' },
          { id: 90, name: 'Custom A', type: 'custom', active: true, emoji: '🎖', description: '' }
        ]
      }
    }

    render(<RolesSettingsTab group={group} slug='test-group' />, { wrapper: AllTheProviders() })

    const nameInputs = screen.getAllByDisplayValue(/Administrator|Moderator|Host|Custom/)
    expect(nameInputs.map(input => input.value)).toEqual([
      'Administrator',
      'Moderator',
      'Host',
      'Custom A',
      'Custom B'
    ])
  })
})

describe('RolesSettingsTab Member card', () => {
  const inviteMembers = { id: '41', title: 'Invite Members', description: 'Send personal email invitations to this group.' }
  let savedFlag

  function groupWith (memberRole, groupRoles = []) {
    return { id: 1, slug: 'test-group', groupRoles: { items: groupRoles }, memberRole }
  }

  beforeEach(() => {
    savedFlag = process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
    delete process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
  })

  afterEach(() => {
    if (savedFlag === undefined) {
      delete process.env.VITE_FEATURE_FLAG_MEMBER_INVITES
    } else {
      process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = savedFlag
    }
  })

  it('shows the Member role read-only, with Invite Members when everyone can invite', () => {
    const memberRole = { id: '9', name: 'Member', responsibilities: { items: [inviteMembers] } }
    render(<RolesSettingsTab group={groupWith(memberRole)} slug='test-group' />, { wrapper: AllTheProviders() })

    const card = screen.getByTestId('member-role-card')
    expect(within(card).getByText('Member')).toBeInTheDocument()
    expect(within(card).getByText('Everyone in this group holds this role.')).toBeInTheDocument()
    expect(within(card).getByText('Invite Members')).toBeInTheDocument()
    expect(within(card).queryByText('Remove')).not.toBeInTheDocument()
    expect(within(card).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(card).queryByText('+ Add Member to Role')).not.toBeInTheDocument()
    expect(within(card).queryByText('+ Add Responsibility to Role')).not.toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Change who can add new members in Privacy & Access' }))
      .toHaveAttribute('href', '/groups/test-group/settings/privacy')
  })

  it("lets stewards add and remove the group's own responsibilities, but not built-in ones", async () => {
    let added = null
    let removed = null
    mockGraphqlServer.use(
      graphql.query('fetchResponsibiltiesForGroup', () => HttpResponse.json({
        data: {
          responsibilities: [
            { ...inviteMembers, type: 'system' },
            { id: '42', title: 'Manage Content', type: 'system', description: '' },
            { id: '60', title: 'Welcome newcomers', type: 'group', description: 'Say hello' },
            { id: '61', title: 'Water the garden', type: 'group', description: '' }
          ]
        }
      })),
      graphql.query('fetchResponsibilitiesForGroupRole', () => HttpResponse.json({
        data: {
          responsibilities: [
            { id: '900', responsibilityId: '41', title: 'Invite Members', type: 'system', description: '' },
            { id: '901', responsibilityId: '61', title: 'Water the garden', type: 'group', description: '' }
          ]
        }
      })),
      graphql.operation(({ query, variables }) => {
        if (query.includes('addResponsibilityToRole')) {
          added = variables
          return HttpResponse.json({ data: { addResponsibilityToRole: { id: '902', title: 'Welcome newcomers', description: 'Say hello', type: 'group', responsibilityId: '60' } } })
        }
        if (query.includes('removeResponsibilityFromRole')) {
          removed = variables
          return HttpResponse.json({ data: { removeResponsibilityFromRole: { success: true } } })
        }
        return HttpResponse.json({ data: {} })
      })
    )
    const confirm = jest.spyOn(window, 'confirm').mockImplementation(() => true)
    const memberRole = { id: '9', name: 'Member', responsibilities: { items: [inviteMembers] } }
    render(<RolesSettingsTab group={groupWith(memberRole)} slug='test-group' />, { wrapper: AllTheProviders() })

    const card = screen.getByTestId('member-role-card')
    await within(card).findByText('Water the garden')
    const inviteRow = within(card).getByText('Invite Members').closest('div')
    expect(within(inviteRow.parentElement).queryByText('Remove')).not.toBeInTheDocument()

    fireEvent.click(within(card).getByText('+ Add Responsibility to Role'))
    expect(await within(card).findByText('Welcome newcomers')).toBeInTheDocument()
    expect(within(card).queryByText('Manage Content')).not.toBeInTheDocument()
    fireEvent.click(within(card).getByText('Welcome newcomers'))
    await waitFor(() => expect(added).toEqual({ groupId: 1, roleId: '9', responsibilityId: '60' }))

    const gardenRow = within(card).getByText('Water the garden').parentElement.parentElement
    fireEvent.click(within(gardenRow).getByText('Remove'))
    await waitFor(() => expect(removed).toEqual({ groupId: 1, roleResponsibilityId: '901' }))
    await waitFor(() => expect(within(card).queryByText('Water the garden')).not.toBeInTheDocument())
    confirm.mockRestore()
  })

  it('shows no responsibilities when members cannot invite', () => {
    const memberRole = { id: '9', name: 'Member', responsibilities: { items: [] } }
    render(<RolesSettingsTab group={groupWith(memberRole)} slug='test-group' />, { wrapper: AllTheProviders() })

    const card = screen.getByTestId('member-role-card')
    expect(within(card).getByText('No responsibilities')).toBeInTheDocument()
    expect(within(card).queryByText('Invite Members')).not.toBeInTheDocument()
  })

  it('is not shown without a Member role, and never lists it among the custom roles', () => {
    const groupRoles = [
      { id: 9, name: 'Member', type: 'member', active: true, emoji: '', description: '' },
      { id: 90, name: 'Custom A', type: 'custom', active: true, emoji: '🎖', description: '' }
    ]
    render(<RolesSettingsTab group={groupWith(null, groupRoles)} slug='test-group' />, { wrapper: AllTheProviders() })

    expect(screen.queryByTestId('member-role-card')).not.toBeInTheDocument()
    expect(screen.getAllByDisplayValue(/Member|Custom/).map(input => input.value)).toEqual(['Custom A'])
  })

  it('is hidden, and Invite Members is not offered to custom roles, while member invitations are switched off', async () => {
    process.env.VITE_FEATURE_FLAG_MEMBER_INVITES = 'off'
    mockGraphqlServer.use(
      graphql.query('fetchResponsibiltiesForGroup', () => HttpResponse.json({
        data: {
          responsibilities: [
            { ...inviteMembers, type: 'system' },
            { id: '42', title: 'Manage Content', type: 'system', description: '' }
          ]
        }
      })),
      graphql.query('fetchGroupRoleDetails', () => HttpResponse.json({
        data: { group: { id: 1, members: { items: [], hasMore: false } }, responsibilities: [] }
      }))
    )
    const memberRole = { id: '9', name: 'Member', responsibilities: { items: [inviteMembers] } }
    const groupRoles = [{ id: 90, name: 'Custom A', type: 'custom', active: true, emoji: '🎖', description: '' }]
    render(<RolesSettingsTab group={groupWith(memberRole, groupRoles)} slug='test-group' />, { wrapper: AllTheProviders() })

    expect(screen.queryByTestId('member-role-card')).not.toBeInTheDocument()

    fireEvent.click(await screen.findByText('+ Add Responsibility to Role'))
    expect(await screen.findByText('Manage Content')).toBeInTheDocument()
    expect(screen.queryByText('Invite Members')).not.toBeInTheDocument()
  })

  it('offers Invite Members to custom roles while member invitations are on', async () => {
    mockGraphqlServer.use(
      graphql.query('fetchResponsibiltiesForGroup', () => HttpResponse.json({
        data: { responsibilities: [{ ...inviteMembers, type: 'system' }] }
      })),
      graphql.query('fetchGroupRoleDetails', () => HttpResponse.json({
        data: { group: { id: 1, members: { items: [], hasMore: false } }, responsibilities: [] }
      }))
    )
    const groupRoles = [{ id: 90, name: 'Custom A', type: 'custom', active: true, emoji: '🎖', description: '' }]
    render(<RolesSettingsTab group={groupWith(null, groupRoles)} slug='test-group' />, { wrapper: AllTheProviders() })

    fireEvent.click(await screen.findByText('+ Add Responsibility to Role'))
    expect(await screen.findByText('Invite Members')).toBeInTheDocument()
  })
})

describe('RoleList', () => {
  it('renders correctly', async () => {
    const props = {
      clearStewardSuggestions: jest.fn(),
      fetchStewardSuggestions: jest.fn(),
      roleId: '1',
      slug: 'foogroup',
      suggestions: [],
      isSystemRole: true,
      group: { id: 1 },
      availableResponsibilities: []
    }

    mockGraphqlServer.use(
      graphql.query('fetchGroupRoleDetails', () => {
        return HttpResponse.json({
          data: {
            group: {
              id: 1,
              members: { items: [], hasMore: false }
            },
            responsibilities: []
          }
        })
      })
    )

    render(<RoleList {...props} />, { wrapper: AllTheProviders() })

    await waitFor(() => {
      expect(screen.getByText('Responsibilities')).toBeInTheDocument()
      expect(screen.getByText('Members')).toBeInTheDocument()
      expect(screen.getByText('Common roles cannot have their responsibilities edited')).toBeInTheDocument()
    })
  })

  const roleListProps = {
    clearStewardSuggestions: jest.fn(),
    fetchStewardSuggestions: jest.fn(),
    roleId: '1',
    slug: 'foogroup',
    suggestions: [],
    isSystemRole: true,
    group: { id: 1 },
    availableResponsibilities: []
  }
  const holders = {
    data: {
      group: {
        id: 1,
        members: {
          hasMore: false,
          items: [
            { id: '11', name: 'Ada Admin', avatarUrl: '', groupRoles: { items: [] } },
            { id: '12', name: 'Bo Builder', avatarUrl: '', groupRoles: { items: [] } }
          ]
        }
      },
      responsibilities: []
    }
  }

  it('shows a loading line until the role holders arrive, then lists them', async () => {
    mockGraphqlServer.use(
      graphql.query('fetchGroupRoleDetails', () => HttpResponse.json(holders))
    )

    render(<RoleList {...roleListProps} />, { wrapper: AllTheProviders() })

    expect(screen.getByTestId('role-details-loading')).toBeInTheDocument()
    expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
    expect(screen.getByText('Bo Builder')).toBeInTheDocument()
    expect(screen.queryByTestId('role-details-loading')).not.toBeInTheDocument()
    expect(screen.queryByTestId('role-details-error')).not.toBeInTheDocument()
  })

  it('keeps the holder and says why when the group would be left without an Administrator', async () => {
    mockGraphqlServer.use(
      graphql.query('fetchGroupRoleDetails', () => HttpResponse.json(holders)),
      graphql.operation(() => HttpResponse.json({
        errors: [{ message: 'A group must keep at least one Administrator' }],
        data: { removeRoleFromMember: null }
      }))
    )
    const confirm = jest.spyOn(window, 'confirm').mockImplementation(() => true)
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {})

    render(<RoleList {...roleListProps} />, { wrapper: AllTheProviders() })

    expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
    fireEvent.click(screen.getAllByText('Remove')[0])

    await waitFor(() => expect(alert).toHaveBeenCalledWith('A group must keep at least one Administrator'))
    expect(screen.getByText('Ada Admin')).toBeInTheDocument()
    confirm.mockRestore()
    alert.mockRestore()
  })

  it('says when the role holders could not be loaded, and loads them on Try Again', async () => {
    let calls = 0
    mockGraphqlServer.use(
      graphql.query('fetchGroupRoleDetails', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ error: 'unavailable' }, { status: 503 })
          : HttpResponse.json(holders)
      })
    )
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    render(<RoleList {...roleListProps} />, { wrapper: AllTheProviders() })

    const error = await screen.findByTestId('role-details-error')
    expect(error).toHaveTextContent("Couldn't load this role's members and responsibilities.")
    expect(screen.queryByText('Ada Admin')).not.toBeInTheDocument()

    await userEvent.click(within(error).getByRole('button', { name: 'Try Again' }))

    expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
    expect(screen.queryByTestId('role-details-error')).not.toBeInTheDocument()
    expect(calls).toBe(2)
    consoleError.mockRestore()
  })
})

describe('AddMemberToRole', () => {
  it('renders correctly, and transitions from not adding to adding', async () => {
    const props = {
      groupId: 1,
      roleId: '1',
      updateLocalMembersForRole: jest.fn()
    }

    render(<AddMemberToRole {...props} />, { wrapper: AllTheProviders() })

    expect(screen.getByText('+ Add Member to Role')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByTestId('add-new'))

    expect(screen.getByPlaceholderText('Search here for a member to add to this role')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
  })

  it('renders correctly when adding with suggestions', async () => {
    const props = {
      groupId: 1,
      roleId: '1',
      updateLocalMembersForRole: jest.fn(),
      memberSuggestions: [
        { id: 1, name: 'Demeter' },
        { id: 2, name: 'Ares' },
        { id: 3, name: 'Hermes' }
      ]
    }

    render(<AddMemberToRole {...props} />, { wrapper: AllTheProviders() })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('add-new'))

    await waitFor(() => {
      expect(screen.getByText('Demeter')).toBeInTheDocument()
      expect(screen.getByText('Ares')).toBeInTheDocument()
      expect(screen.getByText('Hermes')).toBeInTheDocument()
    })
  })
})
