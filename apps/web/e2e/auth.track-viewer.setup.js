import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { gotoLoginAndWaitForEmail } from './helpers/waitForLoginEmailVisible.js'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

/** Public-group member without Coordinator — track paywall visible (`seed-e2e-baseline.js`). */
const authFile = path.resolve(import.meta.dirname, '.auth/track-viewer-session.json')
const E2E_LOGIN_EMAIL = 'e2e.track-viewer@hylo.test'
const E2E_LOGIN_PASSWORD = 'e2e-password-123'

const AUTH_BOOTSTRAP_MS = 120000

setup('authenticate track viewer', async ({ page }) => {
  const emailInput = await gotoLoginAndWaitForEmail(page)

  await emailInput.fill(E2E_LOGIN_EMAIL)
  await page.getByLabel('password', { exact: true }).fill(E2E_LOGIN_PASSWORD)

  await page.getByRole('button', { name: /sign\s*in/i }).click()

  const authShell = page.locator('#center-column-container')
  await expect(authShell).toBeVisible({ timeout: AUTH_BOOTSTRAP_MS })

  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  await page.context().storageState({ path: authFile })
})
