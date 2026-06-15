import { expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './waitPastRootSessionLoading.js'

/**
 * Cold Vite + first `/login` compile can exceed 120s on a busy machine (full suite + many workers).
 * Keep stacked worst-case under setup project timeout (720s): goto + load + loader gate + `#email`.
 */
const DEFAULT_GOTO_MS = 180000
const DEFAULT_FORM_MS = 180000

const sessionGateOpts = {
  waitForLoaderVisibleTimeoutMs: 45000,
  loaderGoneTimeoutMs: 120000
}

/**
 * After /login navigation: past RootRouter checkLogin, then lazy Login chunk — `#email` is the stable gate (not the h1; i18n / paint order).
 * Does not run a second in-helper navigation: `setup` projects use Playwright `retries` instead, so we avoid doubling goto + loader + form waits (which could exceed the project wall clock).
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [opts]
 * @param {number} [opts.gotoTimeoutMs]
 * @param {number} [opts.loginFormTimeoutMs]
 */
export async function gotoLoginAndWaitForEmail (page, opts = {}) {
  const gotoTimeoutMs =
    Number(process.env.E2E_AUTH_GOTO_TIMEOUT_MS) >= 5000
      ? Number(process.env.E2E_AUTH_GOTO_TIMEOUT_MS)
      : (opts.gotoTimeoutMs ?? DEFAULT_GOTO_MS)
  const loginFormTimeoutMs =
    Number(process.env.E2E_AUTH_LOGIN_FORM_TIMEOUT_MS) >= 10000
      ? Number(process.env.E2E_AUTH_LOGIN_FORM_TIMEOUT_MS)
      : (opts.loginFormTimeoutMs ?? DEFAULT_FORM_MS)

  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: gotoTimeoutMs })
  await expect(page).toHaveURL(/\/login/)
  await page.waitForLoadState('load', { timeout: 90000 }).catch(() => {})

  await waitPastRootSessionLoading(page, sessionGateOpts)

  const email = page.locator('#email')
  await expect(email).toBeVisible({ timeout: loginFormTimeoutMs })
  return email
}
