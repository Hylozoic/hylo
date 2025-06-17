import React from 'react'
import { graphql, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import RolesSettingsTab, { AddMemberToRole, RoleList } from './RolesSettingsTab'

const FETCH_STEWARD_SUGGESTIONS = 'FETCH_STEWARD_SUGGESTIONS'
const CLEAR_STEWARD_SUGGESTIONS = 'CLEAR_STEWARD_SUGGESTIONS'

const mockFetchStewardSuggestions = jest.fn()
const mockingFetchStewardSuggestions = jest.fn((f, id, autocomplete) => {
  mockFetchStewardSuggestions(autocomplete)
  return f()
})
const mockClearStewardSuggestions = jest.fn()
const mockingClearStewardSuggestions = jest.fn((f) => {
  mockClearStewardSuggestions()
  return f()
})
jest.mock('./RolesSettingsTab.store', () => {
  const actual = jest.requireActual('./RolesSettingsTab.store')
  return {
    __esModule: true,
    default: actual.default,
    fetchStewardSuggestions: (id, autocomplete) => mockingFetchStewardSuggestions(actual.fetchStewardSuggestions, id, autocomplete),
    clearStewardSuggestions: () => mockingClearStewardSuggestions(actual.clearStewardSuggestions),
    MODULE_NAME: 'RolesSettingsTab'
  }
})

const mockInitialState = {
  RoleSettings: []
}

beforeEach(() => {
  mockGraphqlServer.use(
    graphql.query('fetchResponsibilitiesForCommonRole', () => {
      return HttpResponse.json({
        data: {
          responsibilities: []
        }
      })
    }),
    graphql.query('fetchResponsibiltiesForGroup', () => {
      return HttpResponse.json({
        data: {
          responsibilities: []
        }
      })
    }),
    graphql.query('fetchMembersForCommonRole', () => {
      return HttpResponse.json({
        data: {
          group: {
            members: {
              items: []
            }
          }
        }
      })
    }),
    graphql.operation(({ query, variables }) => {
      return HttpResponse.json({
        data: {
          group: {
            id: '1',
            members: {
              hasMore: false,
              items: [
                { id: '1', name: 'Demeter', avatarUrl: null },
                { id: '2', name: 'Ares', avatarUrl: null },
                { id: '3', name: 'Hermes', avatarUrl: null }
              ]
            }
          }
        }
      })
    }, )
  )
})

describe('RolesSettingsTab', () => {
  it('clears suggestions on unmount', () => {
    const { unmount } = render(
      <RolesSettingsTab commonRoles={[]} />,
      { wrapper: AllTheProviders(mockInitialState) }
    )
    unmount()
    expect(mockClearStewardSuggestions).toHaveBeenCalled()
  })
})

describe('RoleList', () => {
  it('renders correctly', async () => {
    const props = {
      mockClearStewardSuggestions: jest.fn(),
      mockFetchStewardSuggestions: jest.fn(),
      roleId: '1',
      slug: 'foogroup',
      suggestions: [],
      isCommonRole: true,
      group: { id: 1 },
      t: (str) => str
    }

    render(<RoleList {...props} />, { wrapper: AllTheProviders(mockInitialState) })

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
      fetchSuggestions: jest.fn(),
      clearSuggestions: jest.fn()
    }

    render(<AddMemberToRole {...props} />, { wrapper: AllTheProviders(mockInitialState) })

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

    render(<AddMemberToRole {...props} />, { wrapper: AllTheProviders(mockInitialState) })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('add-new'))

    await waitFor(() => {
      expect(screen.getByText('Demeter')).toBeInTheDocument()
      expect(screen.getByText('Ares')).toBeInTheDocument()
      expect(screen.getByText('Hermes')).toBeInTheDocument()
    })
  })

  it('handles interactions correctly', async () => {
    render(
      <AddMemberToRole
        fetchSuggestions={mockFetchStewardSuggestions}
        clearSuggestions={mockClearStewardSuggestions}
      />,
      { wrapper: AllTheProviders(mockInitialState) }
    )

    const user = userEvent.setup()
    mockFetchStewardSuggestions.mockClear()
    mockClearStewardSuggestions.mockClear()

    await user.click(screen.getByTestId('add-new'))
    expect(mockClearStewardSuggestions).toHaveBeenCalledTimes(1)

    const input = screen.getByTestId('add-member-input')
    mockFetchStewardSuggestions.mockClear()
    mockClearStewardSuggestions.mockClear()

    await user.type(input, 'Artem')
    expect(mockFetchStewardSuggestions).toHaveBeenCalledWith('Artem')
    expect(mockClearStewardSuggestions).not.toHaveBeenCalled()

    mockFetchStewardSuggestions.mockClear()
    mockClearStewardSuggestions.mockClear()

    await user.clear(input)
    expect(mockFetchStewardSuggestions).not.toHaveBeenCalled()
    expect(mockClearStewardSuggestions).toHaveBeenCalledTimes(1)

    mockFetchStewardSuggestions.mockClear()
    mockClearStewardSuggestions.mockClear()

    await user.keyboard('{Enter}')
    expect(mockClearStewardSuggestions).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(mockClearStewardSuggestions).toHaveBeenCalled()
  })
})
