import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen, waitFor, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import ManageNotifications from './ManageNotifications'

const mockApiCalls = []
let mockSettingsResponse

jest.mock('store/middleware/apiMiddleware', () => (req) => {
  return store => next => action => {
    if (!action.payload?.api) return next(action)
    mockApiCalls.push(action.payload.api)
    return Promise.resolve({ ...action, payload: mockSettingsResponse })
  }
})

// Native selects stand in for the Radix ones, which jsdom can't open
jest.mock('components/ui/select', () => {
  const React = require('react')
  return {
    Select: ({ value, onValueChange, disabled, children }) =>
      React.createElement('select', { value, disabled, onChange: e => onValueChange(e.target.value) }, children),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }) => React.createElement(React.Fragment, null, children),
    SelectItem: ({ value, disabled, children }) => React.createElement('option', { value, disabled }, children)
  }
})

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  const reduxState = { orm: ormSession.state }
  return AllTheProviders(reduxState)
}

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ name: 'Philharmonic', token: 'hjkhkjhkjh' })
}))

describe('ManageNotifications', () => {
  beforeEach(() => {
    mockApiCalls.length = 0
    mockSettingsResponse = { commentNotifications: 'email', dmNotifications: 'push', postNotifications: 'important', digestFrequency: 'daily' }
  })

  it('renders correctly', async () => {
    render(
      <ManageNotifications />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      expect(screen.getByText('Hi Philharmonic')).toBeInTheDocument()
    })
  })

  it("shows '~ Mixed ~' when memberships differ", async () => {
    mockSettingsResponse = { ...mockSettingsResponse, digestFrequency: 'mixed', postNotifications: 'mixed' }
    render(
      <ManageNotifications />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      const [digestSelect, postSelect] = screen.getAllByRole('combobox')
      expect(digestSelect).toHaveValue('mixed')
      expect(postSelect).toHaveValue('mixed')
    })
    expect(screen.getAllByRole('option', { name: '~ Mixed ~' })).toHaveLength(2)
    screen.getAllByRole('option', { name: '~ Mixed ~' }).forEach(option => expect(option).toBeDisabled())
  })

  it('says comment mentions still notify, until everything is unsubscribed', async () => {
    const note = 'Comments that mention you still notify you, by email and push where your group settings allow.'
    render(
      <ManageNotifications />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      expect(screen.getByText(note)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.queryByText(note)).not.toBeInTheDocument()
  })

  it('sends only the settings that were changed', async () => {
    render(
      <ManageNotifications />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('daily')
    })

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'weekly' } })
    fireEvent.click(screen.getByText('Save Settings'))

    await waitFor(() => {
      expect(mockApiCalls.some(call => call.path === '/noo/user/update-notification-settings')).toBe(true)
    })
    const update = mockApiCalls.find(call => call.path === '/noo/user/update-notification-settings')
    expect(update.params).toEqual({ token: 'hjkhkjhkjh', unsubscribeAll: false, digestFrequency: 'weekly' })
  })
})
