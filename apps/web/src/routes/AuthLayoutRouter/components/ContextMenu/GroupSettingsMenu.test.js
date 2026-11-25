import React from 'react'
import GroupSettingsMenu from './GroupSettingsMenu'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'

jest.mock('store/selectors/hasResponsibilityForGroup', () => () => true)
jest.mock('tours/useTour', () => () => ({ invitation: null }))

describe('GroupSettingsMenu', () => {
  const group = { id: '1', slug: 'foo', name: 'Foomunity' }
  const saved = process.env.VITE_FEATURE_FLAG_HYLO_PRO

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.VITE_FEATURE_FLAG_HYLO_PRO
    } else {
      process.env.VITE_FEATURE_FLAG_HYLO_PRO = saved
    }
  })

  it('links to Billing when the HYLO_PRO flag is on', () => {
    process.env.VITE_FEATURE_FLAG_HYLO_PRO = 'on'
    render(<GroupSettingsMenu group={group} />)
    expect(screen.getByText('Billing')).toBeInTheDocument()
  })

  it('hides Billing when the HYLO_PRO flag is off', () => {
    process.env.VITE_FEATURE_FLAG_HYLO_PRO = 'off'
    render(<GroupSettingsMenu group={group} />)
    expect(screen.queryByText('Billing')).not.toBeInTheDocument()
    expect(screen.getByText('Paid Content')).toBeInTheDocument()
  })
})
