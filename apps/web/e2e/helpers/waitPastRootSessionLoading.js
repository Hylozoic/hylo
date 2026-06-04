import { expect } from '@playwright/test'

/**
 * RootRouter blocks on checkLogin behind fullscreen `<Loading type="fullscreen" />`, which
 * is the only production use of `loading-container` with `h-screen`. Route-level loaders
 * (e.g. ThreadList, MessageSection) reuse the same test id without `h-screen`, so counting
 * all loading containers would hang on `/messages` and similar routes.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {number} [options.loaderGoneTimeoutMs] - wait for all fullscreen loaders to unmount (cold API / CI)
 * @param {number} [options.waitForLoaderVisibleTimeoutMs] - wait for loader to appear first; 0 skips (default 15000). Auth setup uses a larger value so we do not "pass" before React paints the loader.
 */
export async function waitPastRootSessionLoading (page, options = {}) {
  const loaderGoneTimeoutMs = options.loaderGoneTimeoutMs ?? 90000
  const waitForLoaderVisibleTimeoutMs =
    options.waitForLoaderVisibleTimeoutMs !== undefined
      ? options.waitForLoaderVisibleTimeoutMs
      : 15000

  const loader = page.locator('[data-testid="loading-container"].h-screen')
  if (waitForLoaderVisibleTimeoutMs > 0) {
    await loader.first().waitFor({ state: 'visible', timeout: waitForLoaderVisibleTimeoutMs }).catch(() => {})
  }
  await expect(loader).toHaveCount(0, { timeout: loaderGoneTimeoutMs })
}
