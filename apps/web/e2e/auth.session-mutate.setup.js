import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

/** Separate from `session.json` so logout tests never invalidate the primary E2E user cookie. */
const authFile = path.resolve(import.meta.dirname, '.auth/session-mutate-user.json')
const E2E_LOGIN_EMAIL = 'e2e.session-mutate@hylo.test'
const E2E_LOGIN_PASSWORD = 'e2e-password-123'

const GOTO_TIMEOUT_MS = 60000
const LOGIN_FORM_TIMEOUT_MS = 120000
const AUTH_BOOTSTRAP_MS = 120000

setup('authenticate session-mutate user', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: GOTO_TIMEOUT_MS })
  await expect(page).toHaveURL(/\/login/)

  const emailInput = page.locator('#email')
  await expect(emailInput).toBeVisible({ timeout: LOGIN_FORM_TIMEOUT_MS })

  await emailInput.fill(E2E_LOGIN_EMAIL)
  await page.locator('#password').fill(E2E_LOGIN_PASSWORD)

  await page.getByRole('button', { name: /sign\s*in/i }).click()

  const authShell = page.locator('#center-column-container')
  await expect(authShell).toBeVisible({ timeout: AUTH_BOOTSTRAP_MS })

  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  await page.context().storageState({ path: authFile })
})
