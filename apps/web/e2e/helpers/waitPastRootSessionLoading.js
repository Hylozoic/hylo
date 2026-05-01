import { expect } from '@playwright/test'

/**
 * RootRouter blocks on checkLogin behind fullscreen Loading; waiting only for zero
 * `[data-testid="loading-container"]` nodes can race the first paint (same as unauth E2E).
 *
 * @param {import('@playwright/test').Page} page
 */
export async function waitPastRootSessionLoading (page) {
  const loader = page.locator('[data-testid="loading-container"]')
  await loader.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  await expect(loader).toHaveCount(0, { timeout: 90000 })
}
