import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from 'util/testing/reactTestingLibraryExtended'
import { fetchGroupSettings, updateGroupSettings } from '../GroupSettings.store'
import GroupPaywallSection from './GroupPaywallSection'

const mockDispatch = jest.fn(() => Promise.resolve({}))

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}))

jest.mock('../GroupSettings.store', () => ({
  updateGroupSettings: jest.fn((id, changes) => ({ type: 'TEST_UPDATE_GROUP_SETTINGS', id, changes })),
  fetchGroupSettings: jest.fn(slug => ({ type: 'TEST_FETCH_GROUP_SETTINGS', slug }))
}))

const group = { id: '1', slug: 'garden-club', paywall: true, settings: {} }

describe('GroupPaywallSection preview setting', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    updateGroupSettings.mockClear()
    fetchGroupSettings.mockClear()
  })

  it('is on by default and turns off with the switch', async () => {
    const user = userEvent.setup()
    render(<GroupPaywallSection group={group} offerings={[]} />)

    const toggle = screen.getByRole('switch', { name: 'Show a preview before purchase' })
    expect(toggle).toBeChecked()

    await user.click(toggle)

    await waitFor(() => expect(updateGroupSettings).toHaveBeenCalledWith('1', { settings: { showPaywallPreview: false } }))
    expect(fetchGroupSettings).toHaveBeenCalledWith('garden-club')
  })

  it('shows the preview as off when a steward turned it off', () => {
    render(<GroupPaywallSection group={{ ...group, settings: { showPaywallPreview: false } }} offerings={[]} />)

    expect(screen.getByRole('switch', { name: 'Show a preview before purchase' })).not.toBeChecked()
  })
})
