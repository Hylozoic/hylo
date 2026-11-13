import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Group themes against the real backend: an Administrator saves a theme from
 * Group Settings > Appearance, the group renders it after a reload (so it came
 * back through the group queries), the global nav keeps the viewer's theme,
 * leaving the group removes it, and "Reset to default" clears it.
 * Requires the E2E seed's Administrator role for the login user on e2e-public-group.
 */

test.describe.configure({ timeout: 180000, mode: 'serial' })

const GROUP_SLUG = 'e2e-public-group'
const uiTimeout = { timeout: 60000 }

const bodyVar = (page, name) => page.evaluate(n => document.body.style.getPropertyValue(n), name)

async function openAppearance (page) {
  await page.goto(`/groups/${GROUP_SLUG}/settings/appearance`)
  await waitPastRootSessionLoading(page)
  await expect(page.getByTestId('group-theme-editor')).toBeVisible(uiTimeout)
}

test.describe('group theme', () => {
  test.skip(({ isMobile }) => isMobile, 'The editor flow is covered on desktop')

  test('saves a theme, renders it for the group only, then resets it', async ({ page }) => {
    await openAppearance(page)
    expect(await bodyVar(page, '--background')).toBe('')

    // Choosing a preset previews it without saving
    await page.getByTestId('group-theme-preset-forest').click()
    await expect(page.locator('style#group-theme-preview')).toHaveCount(1)
    await page.screenshot({ path: 'e2e-screenshots/group-theme-real-1-editor-preview.png', fullPage: true })

    await page.getByRole('button', { name: 'Save theme' }).click()
    await expect(page.getByText('Theme saved')).toBeVisible(uiTimeout)
    await expect(page.locator('style#group-theme-preview')).toHaveCount(0)

    // After a full reload the theme comes from the backend
    await page.goto(`/groups/${GROUP_SLUG}`)
    await waitPastRootSessionLoading(page)
    await expect.poll(() => bodyVar(page, '--background'), uiTimeout).not.toBe('')
    const groupBackground = await bodyVar(page, '--background')
    expect(groupBackground).toMatch(/^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/)

    // The global nav is wrapped in the viewer's own theme
    const navScope = page.getByTestId('global-nav-theme-scope')
    await expect(navScope).toHaveCount(1)
    const navBackground = await navScope.evaluate(el => el.style.getPropertyValue('--background'))
    expect(navBackground).not.toBe('')
    expect(navBackground).not.toBe(groupBackground)
    await page.screenshot({ path: 'e2e-screenshots/group-theme-real-2-themed-group.png' })

    // Leaving the group removes its tokens
    await page.goto('/my/posts')
    await waitPastRootSessionLoading(page)
    await expect.poll(() => bodyVar(page, '--background'), uiTimeout).toBe('')

    // Reset to default clears the saved theme
    await openAppearance(page)
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Reset to default' }).click()
    await expect(page.getByText('Theme reset to default')).toBeVisible(uiTimeout)

    await page.goto(`/groups/${GROUP_SLUG}`)
    await waitPastRootSessionLoading(page)
    await expect(page.locator('#center-column')).toBeVisible(uiTimeout)
    expect(await bodyVar(page, '--background')).toBe('')
    await page.screenshot({ path: 'e2e-screenshots/group-theme-real-3-after-reset.png' })
  })
})
