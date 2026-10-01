import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import { getCookieConsent } from 'util/cookieConsent'
import { BUILDING_HYLO_ABOUT_PATH } from 'util/support'
import * as navStore from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import HelpMenu from './HelpMenu'

const mockShowIntercom = jest.fn()
jest.mock('react-use-intercom', () => ({
  useIntercom: () => ({ show: mockShowIntercom })
}))
jest.mock('driver.js', () => ({ driver: jest.fn() }))

const currentUser = { id: '1', settings: { toursSeen: [] } }

// util/cookieConsent is mocked for every test (config/jest/beforeTestEnvSetup.js)
function setSupportCookies (allowed) {
  getCookieConsent.mockReturnValue({ analytics: allowed, support: allowed })
}

afterEach(() => {
  getCookieConsent.mockReturnValue(null)
  mockShowIntercom.mockClear()
})

describe('HelpMenu', () => {
  it('offers Join Building Hylo, linking to its About page', async () => {
    const user = userEvent.setup()
    render(<HelpMenu currentUser={currentUser} />)

    await user.click(screen.getByRole('button', { name: 'Help' }))

    const item = await screen.findByRole('menuitem', { name: 'Join Building Hylo' })
    expect(item).toHaveAttribute('href', BUILDING_HYLO_ABOUT_PATH)
    expect(screen.getByRole('menuitem', { name: 'Feedback & Support' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Take a tour/ })).toBeInTheDocument()
  })

  it('closes the phone nav drawer when opening Building Hylo', async () => {
    const toggleNavMenu = jest.spyOn(navStore, 'toggleNavMenu')
    const user = userEvent.setup()
    render(<HelpMenu currentUser={currentUser} />)

    await user.click(screen.getByRole('button', { name: 'Help' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Join Building Hylo' }))

    expect(toggleNavMenu).toHaveBeenCalledWith(false)
    expect(window.location.pathname).toBe(BUILDING_HYLO_ABOUT_PATH)
    toggleNavMenu.mockRestore()
  })

  it('opens the support chat when support cookies are allowed', async () => {
    setSupportCookies(true)
    const user = userEvent.setup()
    render(<HelpMenu currentUser={currentUser} />)

    await user.click(screen.getByRole('button', { name: 'Help' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Feedback & Support' }))

    expect(mockShowIntercom).toHaveBeenCalled()
    expect(screen.queryByText('Support Chat Disabled')).not.toBeInTheDocument()
  })

  it('points to Building Hylo when support cookies were rejected', async () => {
    setSupportCookies(false)
    const user = userEvent.setup()
    render(<HelpMenu currentUser={currentUser} />)

    await user.click(screen.getByRole('button', { name: 'Help' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Feedback & Support' }))

    expect(mockShowIntercom).not.toHaveBeenCalled()
    expect(await screen.findByText('Support Chat Disabled')).toBeInTheDocument()
    expect(screen.getByTestId('support-modal-building-hylo')).toHaveAttribute('href', BUILDING_HYLO_ABOUT_PATH)
  })
})
