import { test as setup } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const authFile = path.resolve(import.meta.dirname, '.auth/session.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_USERNAME
  const password = process.env.E2E_TEST_PASSWORD

  if (!email || !password) {
    throw new Error('E2E_TEST_USERNAME and E2E_TEST_PASSWORD must be set in apps/web/.env')
  }

  // Navigate to the login page
  await page.goto('/login')

  // Fill in the login form
  await page.getByLabel('email').fill(email)
  await page.getByLabel('password').fill(password)

  // Submit the form
  await page.getByRole('button', { name: /sign\s*in/i }).click()

  // Wait for navigation away from the login page (indicates successful auth)
  await page.waitForURL(/^(?!.*\/login)/, { timeout: 15000 })

  console.log('Authenticated successfully')

  // Ensure the auth directory exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true })

  // Save the storage state (cookies + localStorage)
  await page.context().storageState({ path: authFile })
})
