import React from 'react'
import GroupSettings from './GroupSettings'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import useIsPhoneViewport from 'hooks/useIsPhoneViewport'

// Billing visibility under the HYLO_PRO flag: the settings tabs and the phone menu

const mockGroup = { id: '1', slug: 'foo', name: 'Foomunity', type: null }
const mockResponsibilities = [{ title: 'Administration' }]
const mockParentGroups = []

jest.mock('store/selectors/getGroupForSlug', () => () => mockGroup)
jest.mock('store/selectors/getResponsibilitiesForGroup', () => () => mockResponsibilities)
jest.mock('store/selectors/getGroupRelationships', () => ({
  ...jest.requireActual('store/selectors/getGroupRelationships'),
  getParentGroups: () => mockParentGroups
}))
jest.mock('./GroupSettings.store', () => ({
  ...jest.requireActual('./GroupSettings.store'),
  fetchGroupSettings: () => ({ type: 'FETCH_GROUP_SETTINGS_NOOP' })
}))
jest.mock('./GroupSettingsTab', () => () => 'GroupSettingsTab')
jest.mock('hooks/useIsPhoneViewport', () => jest.fn(() => false))
// Show which settings pages GroupSettings offers, and the phone menu (the '' page) on phones
jest.mock('routes/FullPageModal', () => ({ content }) => (
  <div>
    <ul data-testid='settings-pages'>
      {content.map(page => <li key={page.path}>{page.path}</li>)}
    </ul>
    {content.find(page => page.path === '')?.component}
  </div>
))

describe('GroupSettings Billing and the HYLO_PRO flag', () => {
  const saved = process.env.VITE_FEATURE_FLAG_HYLO_PRO

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.VITE_FEATURE_FLAG_HYLO_PRO
    } else {
      process.env.VITE_FEATURE_FLAG_HYLO_PRO = saved
    }
    useIsPhoneViewport.mockReturnValue(false)
  })

  const settingsPages = () => [...screen.getByTestId('settings-pages').querySelectorAll('li')].map(li => li.textContent)

  it('offers the Billing page when the flag is on', () => {
    process.env.VITE_FEATURE_FLAG_HYLO_PRO = 'on'
    render(<GroupSettings />)
    expect(settingsPages()).toContain('billing')
    expect(settingsPages()).toContain('paid-content/*')
  })

  it('has no Billing page when the flag is off, so /settings/billing is an unknown settings path', () => {
    process.env.VITE_FEATURE_FLAG_HYLO_PRO = 'off'
    render(<GroupSettings />)
    expect(settingsPages()).not.toContain('billing')
    expect(settingsPages()).toContain('paid-content/*')
  })

  it('lists Billing in the phone menu only when the flag is on', () => {
    useIsPhoneViewport.mockReturnValue(true)
    process.env.VITE_FEATURE_FLAG_HYLO_PRO = 'on'
    const { unmount } = render(<GroupSettings />)
    expect(screen.getByRole('button', { name: 'Billing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Paid Content' })).toBeInTheDocument()
    unmount()

    process.env.VITE_FEATURE_FLAG_HYLO_PRO = 'off'
    render(<GroupSettings />)
    expect(screen.queryByRole('button', { name: 'Billing' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Paid Content' })).toBeInTheDocument()
  })
})
