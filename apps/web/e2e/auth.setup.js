import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const authFile = path.resolve(import.meta.dirname, '.auth/session.json')
const E2E_LOGIN_EMAIL = 'e2e.user@hylo.test'
const E2E_LOGIN_PASSWORD = 'e2e-password-123'

/** RootRouter blocks on checkLogin; Login mounts `#email` only after. Loader-based waits can race CI/Vite. */
const LOGIN_FORM_TIMEOUT_MS = 120000

setup('authenticate', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'load', timeout: LOGIN_FORM_TIMEOUT_MS })
  await expect(page).toHaveURL(/\/login/)

  const emailInput = page.locator('#email')

  try {
    await emailInput.waitFor({ state: 'visible', timeout: LOGIN_FORM_TIMEOUT_MS })
  } catch {
    await page.reload({ waitUntil: 'load', timeout: LOGIN_FORM_TIMEOUT_MS })
    await emailInput.waitFor({ state: 'visible', timeout: LOGIN_FORM_TIMEOUT_MS })
  }

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
