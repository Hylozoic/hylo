import { test, expect } from '@playwright/test'

test('app loads and shows login or home page', async ({ page }) => {
  await page.goto('/')
  // Verify the app renders without crashing
  await expect(page).toHaveTitle(/.+/)
})
