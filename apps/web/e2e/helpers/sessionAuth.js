import { expect } from '@playwright/test'

const uiTimeout = { timeout: 60000 }

/**
 * Cookie panel can cover the global nav on first load; dismiss if open.
 * @param {import('@playwright/test').Page} page
 */
export async function dismissCookiePreferencesIfOpen (page) {
  const btn = page.getByRole('button', { name: /save and continue/i })
  if (await btn.isVisible().catch(() => false)) {
    await btn.click()
  }
}

/**
 * Opens the gear menu (mobile: opens nav drawer first). Requires authenticated shell.
 * @param {import('@playwright/test').Page} page
 */
export async function openGlobalNavSettingsMenu (page) {
  const vw = page.viewportSize()?.width ?? 1280
  if (vw < 640) {
    await page.locator('header > button').first().click()
  }
  const trigger = page.getByTestId('global-nav-settings-trigger')
  await expect(trigger).toBeVisible(uiTimeout)
  await trigger.click()
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function clickGlobalNavLogout (page) {
  const item = page.getByTestId('global-nav-logout')
  await expect(item).toBeVisible(uiTimeout)
  await item.click()
}
