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

  it('says comment mentions still notify, unless everything is unsubscribed', async () => {
    const note = 'Comments that mention you still notify you, by email and push where your group settings allow.'
    const { unmount } = render(
      <ManageNotifications />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      expect(screen.getByText(note)).toBeInTheDocument()
    })
    unmount()

    mockSettingsResponse = { ...mockSettingsResponse, unsubscribeScope: 'everything' }
    render(
      <ManageNotifications />,
      { wrapper: testProviders() }
    )
    await waitFor(() => {
      expect(screen.getByTestId('saved-unsubscribe-scope')).toBeInTheDocument()
    })
    expect(screen.queryByText(note)).not.toBeInTheDocument()
  })

  it("offers four unsubscribe choices with 'Everything except direct' preselected", async () => {
    render(
      <ManageNotifications />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      expect(screen.getAllByRole('radio')).toHaveLength(4)
    })
    expect(screen.getByRole('radio', { name: /Fewer emails \(digest only\)/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /No group emails/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /Everything except direct/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /^Everything No emails/ })).not.toBeChecked()
    expect(screen.queryByTestId('saved-unsubscribe-scope')).not.toBeInTheDocument()
  })

  it('saves a choice only when Unsubscribe is pressed', async () => {
    render(
      <ManageNotifications />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      expect(screen.getAllByRole('radio')).toHaveLength(4)
    })
    fireEvent.click(screen.getByRole('radio', { name: /No group emails/ }))
    expect(mockApiCalls.some(call => call.path === '/noo/user/update-notification-settings')).toBe(false)

    fireEvent.click(screen.getByTestId('unsubscribe-button'))

    await waitFor(() => {
      expect(screen.getByText('Your choice is saved.')).toBeInTheDocument()
    })
    const update = mockApiCalls.find(call => call.path === '/noo/user/update-notification-settings')
    expect(update.params).toEqual({ token: 'hjkhkjhkjh', unsubscribeScope: 'no_group_emails' })
  })

  it('shows a saved choice and can resubscribe', async () => {
    mockSettingsResponse = { ...mockSettingsResponse, unsubscribeScope: 'digest_only' }
    render(
      <ManageNotifications />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      expect(screen.getByTestId('saved-unsubscribe-scope')).toHaveTextContent('You unsubscribed from: Fewer emails (digest only)')
    })
    expect(screen.getByRole('radio', { name: /Fewer emails \(digest only\)/ })).toBeChecked()

    // After resubscribing, the settings come back without a saved choice
    const { unsubscribeScope, ...resubscribed } = mockSettingsResponse
    mockSettingsResponse = resubscribed
    fireEvent.click(screen.getByTestId('resubscribe-button'))

    await waitFor(() => {
      expect(screen.getByText('You are resubscribed. The settings above apply again.')).toBeInTheDocument()
    })
    expect(mockApiCalls.some(call => call.params?.unsubscribeScope === 'none')).toBe(true)
    expect(screen.queryByTestId('saved-unsubscribe-scope')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Everything except direct/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Fewer emails \(digest only\)/ })).not.toBeChecked()
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
    expect(update.params).toEqual({ token: 'hjkhkjhkjh', digestFrequency: 'weekly' })
  })
})
