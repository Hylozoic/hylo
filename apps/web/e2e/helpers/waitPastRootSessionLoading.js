import { expect } from '@playwright/test'

/**
 * RootRouter blocks on checkLogin behind fullscreen `<Loading type="fullscreen" />`, which
 * is the only production use of `loading-container` with `h-screen`. Route-level loaders
 * (e.g. ThreadList, MessageSection) reuse the same test id without `h-screen`, so counting
 * all loading containers would hang on `/messages` and similar routes.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function waitPastRootSessionLoading (page) {
  const loader = page.locator('[data-testid="loading-container"].h-screen')
  await loader.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  await expect(loader).toHaveCount(0, { timeout: 90000 })
}
