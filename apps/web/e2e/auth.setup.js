import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const authFile = path.resolve(import.meta.dirname, '.auth/session.json')
const E2E_LOGIN_EMAIL = 'e2e.user@hylo.test'
const E2E_LOGIN_PASSWORD = 'e2e-password-123'

/** RootRouter blocks on checkLogin; Login mounts `#email` only after. */
const GOTO_TIMEOUT_MS = 60000
const LOGIN_FORM_TIMEOUT_MS = 120000

/**
 * Forwards useful browser logs in CI (same filter as unauthenticated.routes.spec.js).
 * @param {import('@playwright/test').Page} page
 */
function forwardBrowserLogsForSetup (page) {
  if (process.env.CI !== 'true' && process.env.E2E_FORWARD_BROWSER_LOGS !== '1') return
  page.on('console', msg => {
    const t = msg.text()
    if (t.includes('[Hylo') || t.includes('GraphQL') || msg.type() === 'error') {
      process.stderr.write(`[browser][auth.setup] ${t}\n`)
    }
  })
  page.on('pageerror', err => {
    process.stderr.write(`[browser][auth.setup] pageerror: ${err.message}\n`)
  })
}

setup('authenticate', async ({ page }) => {
  forwardBrowserLogsForSetup(page)

  // `domcontentloaded` avoids rare hangs where dev/HMR keeps `load` from settling before React mounts.
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: GOTO_TIMEOUT_MS })
  await expect(page).toHaveURL(/\/login/)

  const emailInput = page.locator('#email')
  await expect(emailInput).toBeVisible({ timeout: LOGIN_FORM_TIMEOUT_MS })

  await emailInput.fill(E2E_LOGIN_EMAIL)
  await page.locator('#password').fill(E2E_LOGIN_PASSWORD)

  // Submit the form
  await page.getByRole('button', { name: /sign\s*in/i }).click()

  // Wait for navigation away from the login page (indicates successful auth)
  await page.waitForURL(/^(?!.*\/login)/, { timeout: 60000 })

  console.log('Authenticated successfully')

  // Ensure the auth directory exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true })

  // Save the storage state (cookies + localStorage)
  await page.context().storageState({ path: authFile })
})
