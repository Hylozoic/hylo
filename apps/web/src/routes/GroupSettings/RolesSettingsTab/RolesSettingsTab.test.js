import React from 'react'
import { graphql, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { GROUP_ACCESSIBILITY } from 'store/models/Group'
import RolesSettingsTab, { AddMemberToRole, RoleList } from './RolesSettingsTab'

jest.mock('store/actions/trackAnalyticsEvent', () => {
  const actual = jest.requireActual('store/actions/trackAnalyticsEvent')
  return { __esModule: true, default: jest.fn(actual.default) }
})

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

  it('explains the emoji box on a new role and says the emoji is missing on save', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
    const group = {
      id: 1,
      slug: 'test-group',
      groupRoles: { items: [{ id: 100, name: 'Custom B', type: 'custom', active: true, emoji: '⭐', description: '' }] }
    }

    render(<RolesSettingsTab group={group} slug='test-group' />, { wrapper: AllTheProviders() })

    // A role that already has an emoji shows no hint
    expect(screen.queryByText('Click the box to choose an emoji for this role/badge')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Create new role/badge'))

    expect(screen.getByText('Click the box to choose an emoji for this role/badge')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Choose an emoji for this role/badge' })).toHaveLength(2)

    await userEvent.click(screen.getByText('Create Role'))
    expect(alertSpy).toHaveBeenCalledWith('Please choose an emoji for this role/badge by clicking the box next to its name')

    alertSpy.mockRestore()
  })
})

describe('RolesSettingsTab "Who can add new members?"', () => {
  const WHO_CAN_ADD = 'Who can add new members?'
  const STEWARDS = 'Stewards with the Add Members responsibility'
  const EVERYONE = 'Everyone in the Group'
  const APPROVAL = 'Every member can invite people. A steward approves each person before they join.'
  const NO_APPROVAL = 'Every member can invite people, and the people they invite join right away.'

  const baseGroup = {
    id: '1',
    name: 'Seed Library',
    slug: 'seed-library',
    accessibility: GROUP_ACCESSIBILITY.Restricted,
    invitePolicy: 'stewards',
    groupRoles: { items: [] }
  }

  beforeEach(() => {
    trackAnalyticsEvent.mockClear()
  })

  function renderTab (overrides = {}, saveResult = {}) {
    const updateGroupSettings = jest.fn(() => Promise.resolve(saveResult))
    const view = render(
      <RolesSettingsTab group={{ ...baseGroup, ...overrides }} slug='seed-library' updateGroupSettings={updateGroupSettings} />,
      { wrapper: AllTheProviders() }
    )
    return { ...view, updateGroupSettings }
  }

  function choose (optionTitle) {
    fireEvent.click(screen.getByRole('button', { name: WHO_CAN_ADD }))
    fireEvent.click(screen.getByRole('button', { name: optionTitle }))
  }

  it('sits below Common Roles and above Custom Roles', () => {
    renderTab()

    const headings = screen.getAllByRole('heading').map(heading => heading.textContent)
    const common = headings.indexOf('Common Roles')
    const who = headings.indexOf(WHO_CAN_ADD)
    const custom = headings.indexOf('Custom Roles & Badges')
    expect(common).toBeGreaterThanOrEqual(0)
    expect(common).toBeLessThan(who)
    expect(who).toBeLessThan(custom)
    expect(screen.getByText('Choose who can invite people to join Seed Library. Roles that include Add Members can always invite.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: WHO_CAN_ADD })).toHaveTextContent(STEWARDS)
  })

  it('saves the choice as soon as it changes', async () => {
    const { updateGroupSettings } = renderTab()

    choose(EVERYONE)

    expect(updateGroupSettings).toHaveBeenCalledWith({ invitePolicy: 'everyone' })
    await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Invite Policy Set', { mode: 'everyone', surface: 'settings' }))
  })

  it('reports a policy only once it has saved', async () => {
    const { updateGroupSettings } = renderTab({}, { error: true })

    choose(EVERYONE)

    await waitFor(() => expect(updateGroupSettings).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(trackAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('describes whether invited people join right away', () => {
    const { unmount } = renderTab({ accessibility: GROUP_ACCESSIBILITY.Open, invitePolicy: 'everyone' })
    expect(screen.getByText(NO_APPROVAL)).toBeInTheDocument()
    unmount()

    renderTab({ accessibility: GROUP_ACCESSIBILITY.Restricted, invitePolicy: 'everyone' })
    expect(screen.getByText(APPROVAL)).toBeInTheDocument()
  })

  it('is hidden when the policy was not loaded', () => {
    renderTab({ invitePolicy: null })
    expect(screen.queryByRole('heading', { name: WHO_CAN_ADD })).not.toBeInTheDocument()
  })
})

describe('RolesSettingsTab All Members role', () => {
  function groupWith (groupRoles = []) {
    return { id: 1, slug: 'test-group', groupRoles: { items: groupRoles } }
  }

  it('never lists the All Members role among the custom roles', () => {
    const groupRoles = [
      { id: 9, name: 'All Members', type: 'all_members', active: true, emoji: '', description: '' },
      { id: 90, name: 'Custom A', type: 'custom', active: true, emoji: '🎖', description: '' }
    ]
    render(<RolesSettingsTab group={groupWith(groupRoles)} slug='test-group' />, { wrapper: AllTheProviders() })

    expect(screen.queryByDisplayValue('All Members')).not.toBeInTheDocument()
    expect(screen.getAllByDisplayValue(/Custom/).map(input => input.value)).toEqual(['Custom A'])
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

  // Regression for #1673: the role's own responsibilities must be fetched (by groupRoleId) so
  // Remove sends the group_roles_responsibilities id and the item disappears
  it('loads the responsibilities for this role and removes one', async () => {
    const props = {
      roleId: '61',
      slug: 'foogroup',
      suggestions: [],
      isSystemRole: false,
      group: { id: '1' },
      availableResponsibilities: []
    }
    let fetchVariables = null
    let removeVariables = null

    mockGraphqlServer.use(
      graphql.query('fetchGroupRoleDetails', ({ variables }) => {
        fetchVariables = variables
        return HttpResponse.json({
          data: {
            group: { id: '1', members: { items: [], hasMore: false } },
            responsibilities: variables.groupRoleId === '61'
              ? [
                  { id: '141', title: 'Add Members', type: 'system', description: '', responsibilityId: '2' },
                  { id: '142', title: 'Manage Content', type: 'system', description: '', responsibilityId: '4' }
                ]
              : []
          }
        })
      }),
      graphql.operation(({ query, variables }) => {
        if (!query.includes('removeResponsibilityFromRole')) return
        removeVariables = variables
        return HttpResponse.json({ data: { removeResponsibilityFromRole: { success: true } } })
      })
    )
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    render(<RoleList {...props} />, { wrapper: AllTheProviders() })

    expect(await screen.findByText('Manage Content')).toBeInTheDocument()
    expect(fetchVariables.groupRoleId).toBe('61')

    const user = userEvent.setup()
    await user.click(screen.getAllByText('Remove')[1])

    await waitFor(() => {
      expect(screen.queryByText('Manage Content')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Add Members')).toBeInTheDocument()
    expect(removeVariables).toEqual({ groupId: '1', roleResponsibilityId: '142' })
    confirmSpy.mockRestore()
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
