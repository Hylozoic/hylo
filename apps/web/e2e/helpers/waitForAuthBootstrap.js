import { expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './waitPastRootSessionLoading.js'

/**
 * RootRouter `checkLogin` finishes before AuthLayoutRouter `fetchForCurrentUser` /
 * `fetchCommonRoles`. Non-fast-path routes show `data-testid="loading-screen"` until that
 * bootstrap completes; fast-path post URLs mount `#center-column-container` immediately.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 */
export async function waitForAuthBootstrap (page, options = {}) {
  const timeoutMs = options.timeoutMs ?? 90000

  await waitPastRootSessionLoading(page)
  await expect(page.getByTestId('loading-screen')).toHaveCount(0, { timeout: timeoutMs })
  await expect(page.locator('#center-column-container')).toBeVisible({ timeout: timeoutMs })
}
