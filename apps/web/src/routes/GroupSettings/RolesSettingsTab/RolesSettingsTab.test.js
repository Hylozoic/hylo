import React from 'react'
import { graphql, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
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
          { id: 30, name: 'Coordinator', type: 'system', active: true, emoji: '🪄', description: '' },
          { id: 40, name: 'Moderator', type: 'system', active: true, emoji: '⚖️', description: '' },
          { id: 90, name: 'Custom A', type: 'custom', active: true, emoji: '🎖', description: '' }
        ]
      }
    }

    render(<RolesSettingsTab group={group} slug='test-group' />, { wrapper: AllTheProviders() })

    const nameInputs = screen.getAllByDisplayValue(/Coordinator|Moderator|Host|Custom/)
    expect(nameInputs.map(input => input.value)).toEqual([
      'Coordinator',
      'Moderator',
      'Host',
      'Custom A',
      'Custom B'
    ])
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
