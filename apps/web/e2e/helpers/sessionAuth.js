import { expect } from '@playwright/test'

const uiTimeout = { timeout: 60000 }

/** Stable UUID that passes `validateCookieConsent` (version 4 + RFC variant). */
const E2E_COOKIE_CONSENT = {
  id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  analytics: true,
  support: true,
  isLinkedToUser: true,
  lastUpdated: '2026-01-01T00:00:00.000Z'
}

/**
 * Origins Playwright may use for the isolated web server.
 */
function cookieConsentUrls () {
  const port = process.env.E2E_WEB_PORT || process.env.PORT || '3000'
  return [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
}

/**
 * Writes `hylo_cookie_consent` so CookiePreferencesPanel never mounts.
 * Must run before the app document loads (auth setup, or after clearCookies
 * before the next goto). Playwright storageState then carries it into tests.
 * @param {import('@playwright/test').Page} page
 */
export async function ensureHyloCookieConsent (page) {
  const cookies = await page.context().cookies()
  if (cookies.some(c => c.name === 'hylo_cookie_consent')) return
  const value = encodeURIComponent(JSON.stringify(E2E_COOKIE_CONSENT))
  await page.context().addCookies(
    cookieConsentUrls().map(url => ({
      name: 'hylo_cookie_consent',
      value,
      url,
      sameSite: 'Lax'
    }))
  )
}

/**
 * Playwright `isVisible()` is true for the closed mobile drawer (`translateX(-100%)`).
 * Clicks then hang because the control is outside the viewport.
 * @param {import('@playwright/test').Locator} locator
 */
async function isInViewport (locator) {
  const box = await locator.boundingBox().catch(() => null)
  if (!box || box.width < 1 || box.height < 1) return false
  const vw = locator.page().viewportSize()
  if (!vw) return false
  return box.x + box.width > 8 && box.x < vw.width - 8 &&
    box.y + box.height > 8 && box.y < vw.height - 8
}

/**
 * Opens the phone global-nav drawer (ViewHeader chevron) when the create/settings
 * controls are off-screen. No-op on desktop, or if the drawer is already open.
 * Do not tap the chevron a second time: once the drawer is open it covers the
 * header, and Playwright hangs retrying a click the rail intercepts.
 * @param {import('@playwright/test').Page} page
 */
export async function openGlobalNavDrawerIfNeeded (page) {
  const vw = page.viewportSize()?.width ?? 1280
  if (vw >= 640) return
  const create = page.getByTestId('global-nav-create')
  if (await isInViewport(create)) return
  const box = await create.boundingBox().catch(() => null)
  const drawerAlreadyOpen = box && box.x + box.width > 8
  if (!drawerAlreadyOpen) {
    const toggle = page.getByTestId('view-header-nav-toggle')
    await expect(toggle).toBeVisible(uiTimeout)
    await toggle.click()
  }
  await create.scrollIntoViewIfNeeded()
  await expect(create).toBeInViewport(uiTimeout)
}

/**
 * Opens the gear menu (mobile: opens nav drawer first). Requires authenticated shell.
 * @param {import('@playwright/test').Page} page
 */
export async function openGlobalNavSettingsMenu (page) {
  await openGlobalNavDrawerIfNeeded(page)
  const trigger = page.getByTestId('global-nav-settings-trigger')
  await trigger.scrollIntoViewIfNeeded()
  await expect(trigger).toBeInViewport(uiTimeout)
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

/**
 * Idempotent DELETE /noo/session in the browser (same cookie jar as the page), then clear cookies.
 * Use after UI logout before a full `page.goto('/')` when tests must assert an unauthenticated root:
 * the server may invalidate the session without expiring the cookie in the response; a stale cookie
 * can still satisfy `checkLogin` on the next load unless the jar is cleared.
 *
 * Re-writes cookie consent after the wipe so the preferences panel does not cover login.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function ensureBrowserSessionDestroyed (page) {
  await page.evaluate(async () => {
    const res = await fetch('/noo/session', { method: 'DELETE', credentials: 'same-origin' })
    await res.text().catch(() => '')
  })
  await page.context().clearCookies()
  await ensureHyloCookieConsent(page)
}
