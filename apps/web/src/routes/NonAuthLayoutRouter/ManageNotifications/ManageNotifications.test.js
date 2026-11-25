import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen, waitFor, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import ManageNotifications from './ManageNotifications'

const FETCH_PATH = '/noo/user/notification-settings'
const UPDATE_PATH = '/noo/user/update-notification-settings'

const mockApiCalls = []
let mockSettingsResponse
// Errors to reject with, by API path, like fetchJSON does for non-200 responses
let mockApiErrors

jest.mock('store/middleware/apiMiddleware', () => (req) => {
  return store => next => action => {
    if (!action.payload?.api) return next(action)
    mockApiCalls.push(action.payload.api)
    const error = mockApiErrors[action.payload.api.path]
    if (error) return Promise.reject(error)
    return Promise.resolve({ ...action, payload: mockSettingsResponse })
  }
})

function apiError (status, body) {
  const error = new Error(body)
  error.response = { status, body }
  return error
}

const expiredTokenError = () => apiError(403, '{"error":"Unauthorized"}')

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
    mockApiErrors = {}
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
      expect(mockApiCalls.some(call => call.path === UPDATE_PATH)).toBe(true)
    })
    const update = mockApiCalls.find(call => call.path === UPDATE_PATH)
    expect(update.params).toEqual({ token: 'hjkhkjhkjh', unsubscribeAll: false, digestFrequency: 'weekly' })
  })

  it('confirms a successful save', async () => {
    render(<ManageNotifications />, { wrapper: testProviders() })

    fireEvent.click(await screen.findByText('Save Settings'))

    expect(await screen.findByText('Your notification settings have been saved.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says the link has expired, instead of showing the form, when the token is rejected on load', async () => {
    mockApiErrors[FETCH_PATH] = expiredTokenError()
    render(<ManageNotifications />, { wrapper: testProviders() })

    expect(await screen.findByText('This link has expired or is no longer valid.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in to change your notification settings' }))
      .toHaveAttribute('href', '/login?returnToUrl=%2Fmy%2Fnotifications')
    expect(screen.queryByText('Save Settings')).not.toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('says the link has expired when the token is rejected on save', async () => {
    mockApiErrors[UPDATE_PATH] = expiredTokenError()
    render(<ManageNotifications />, { wrapper: testProviders() })

    fireEvent.click(await screen.findByText('Save Settings'))

    expect(await screen.findByText('This link has expired or is no longer valid.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in to change your notification settings' })).toBeInTheDocument()
    expect(screen.queryByText('Your notification settings have been saved.')).not.toBeInTheDocument()
  })

  it('shows an error when the save fails for another reason', async () => {
    mockApiErrors[UPDATE_PATH] = apiError(500, 'Server error')
    render(<ManageNotifications />, { wrapper: testProviders() })

    fireEvent.click(await screen.findByText('Save Settings'))

    expect(await screen.findByText('Your notification settings could not be saved. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText('This link has expired or is no longer valid.')).not.toBeInTheDocument()
  })

  it('shows an error when the settings fail to load for another reason', async () => {
    mockApiErrors[FETCH_PATH] = apiError(500, 'Server error')
    render(<ManageNotifications />, { wrapper: testProviders() })

    expect(await screen.findByText('Your notification settings could not be loaded. Please try again later.')).toBeInTheDocument()
    expect(screen.queryByText('Save Settings')).not.toBeInTheDocument()
  })
})
