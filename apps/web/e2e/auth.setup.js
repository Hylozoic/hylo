import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const authFile = path.resolve(import.meta.dirname, '.auth/session.json')
const E2E_LOGIN_EMAIL = 'e2e.user@hylo.test'
const E2E_LOGIN_PASSWORD = 'e2e-password-123'

setup('authenticate', async ({ page }) => {
  // Navigate to the login page
  await page.goto('/login')

  // RootRouter shows fullscreen Loading until checkLogin resolves; same race as unauth E2E if we only wait for the form
  await waitPastRootSessionLoading(page)

  await expect(page.getByLabel('email')).toBeVisible({ timeout: 60000 })

  // Fill in the login form
  await page.getByLabel('email').fill(E2E_LOGIN_EMAIL)
  await page.getByLabel('password').fill(E2E_LOGIN_PASSWORD)

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
