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
      <RolesSettingsTab clearStewardSuggestions={clearStewardSuggestions} commonRoles={[]} />,
      { wrapper: AllTheProviders() }
    )
    unmount()
    expect(clearStewardSuggestions).toHaveBeenCalled()
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
      isCommonRole: true,
      group: { id: 1 },
      fetchMembersForCommonRole: jest.fn().mockResolvedValue({ response: { payload: { data: { group: { members: { items: [] } } } } } }),
      t: (str) => str
    }

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
