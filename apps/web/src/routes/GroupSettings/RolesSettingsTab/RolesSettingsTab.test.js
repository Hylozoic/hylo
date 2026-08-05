import React from 'react'
import { graphql, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import RolesSettingsTab, { AddMemberToRole, RoleList } from './RolesSettingsTab'

describe('RolesSettingsTab', () => {
  it('clears suggestions on unmount', () => {
    const clearStewardSuggestions = jest.fn()
    const { unmount } = render(
      <RolesSettingsTab clearStewardSuggestions={clearStewardSuggestions} />,
      { wrapper: AllTheProviders() }
    )
    unmount()
    expect(clearStewardSuggestions).toHaveBeenCalled()
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

  it('loads more members when Load more is clicked', async () => {
    const props = {
      clearStewardSuggestions: jest.fn(),
      fetchStewardSuggestions: jest.fn(),
      roleId: '1',
      slug: 'foogroup',
      suggestions: [],
      isSystemRole: false,
      group: { id: 1 },
      availableResponsibilities: []
    }

    let fetchMembersCallCount = 0

    mockGraphqlServer.use(
      graphql.query('fetchGroupRoleDetails', () => {
        return HttpResponse.json({
          data: {
            group: {
              id: 1,
              members: {
                hasMore: true,
                items: [{ id: 1, name: 'Alice', avatarUrl: null, groupRoles: { items: [] } }]
              }
            },
            responsibilities: []
          }
        })
      }),
      graphql.query('fetchMembersForGroupRole', () => {
        fetchMembersCallCount += 1
        return HttpResponse.json({
          data: {
            group: {
              id: 1,
              members: {
                hasMore: false,
                items: [{ id: 2, name: 'Bob', avatarUrl: null, groupRoles: { items: [] } }]
              }
            }
          }
        })
      })
    )

    render(<RoleList {...props} />, { wrapper: AllTheProviders() })

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByText('Load more members'))

    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(fetchMembersCallCount).toBeGreaterThan(0)
    })
  })
})

describe('AddMemberToRole', () => {
  it('renders correctly, and transitions from not adding to adding', async () => {
    const props = {
      fetchSuggestions: jest.fn(),
      clearSuggestions: jest.fn()
    }

    render(<AddMemberToRole {...props} />, { wrapper: AllTheProviders() })

    expect(screen.getByText('+ Add Member to Role')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByTestId('add-new'))

    expect(screen.getByPlaceholderText('Type...')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
  })

  it('renders correctly when adding with suggestions', async () => {
    const props = {
      fetchSuggestions: jest.fn(),
      clearSuggestions: jest.fn(),
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

  it('handles interactions correctly', async () => {
    const fetchStewardSuggestions = jest.fn()
    const clearStewardSuggestions = jest.fn()

    render(
      <AddMemberToRole
        fetchSuggestions={fetchStewardSuggestions}
        clearSuggestions={clearStewardSuggestions}
      />,
      { wrapper: AllTheProviders() }
    )

    const user = userEvent.setup()

    await user.click(screen.getByTestId('add-new'))
    expect(clearStewardSuggestions).toHaveBeenCalledTimes(1)

    const input = screen.getByTestId('add-member-input')
    fetchStewardSuggestions.mockClear()
    clearStewardSuggestions.mockClear()

    await user.type(input, 'Artem')
    expect(fetchStewardSuggestions).toHaveBeenCalledWith('Artem')
    expect(clearStewardSuggestions).not.toHaveBeenCalled()

    fetchStewardSuggestions.mockClear()
    clearStewardSuggestions.mockClear()

    await user.clear(input)
    expect(clearStewardSuggestions).toHaveBeenCalledTimes(1)
    expect(fetchStewardSuggestions).not.toHaveBeenCalled()

    fetchStewardSuggestions.mockClear()
    clearStewardSuggestions.mockClear()

    await user.keyboard('{Enter}')
    expect(clearStewardSuggestions).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(clearStewardSuggestions).toHaveBeenCalled()
  })
})
