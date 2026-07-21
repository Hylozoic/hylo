import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { gotoLoginAndWaitForEmail } from './helpers/waitForLoginEmailVisible.js'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

/** Separate from `session.json` so logout tests never invalidate the primary E2E user cookie. */
const authFile = path.resolve(import.meta.dirname, '.auth/session-mutate-user.json')
const E2E_LOGIN_EMAIL = 'e2e.session-mutate@hylo.test'
const E2E_LOGIN_PASSWORD = 'e2e-password-123'

const AUTH_BOOTSTRAP_MS = 120000

setup('authenticate session-mutate user', async ({ page }) => {
  const emailInput = await gotoLoginAndWaitForEmail(page)

  await emailInput.fill(E2E_LOGIN_EMAIL)
  await page.getByLabel('password', { exact: true }).fill(E2E_LOGIN_PASSWORD)

  await page.getByRole('button', { name: /sign\s*in/i }).click()

  const authShell = page.locator('#center-column-container')
  await expect(authShell).toBeVisible({ timeout: AUTH_BOOTSTRAP_MS })

  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  await page.context().storageState({ path: authFile })
})
