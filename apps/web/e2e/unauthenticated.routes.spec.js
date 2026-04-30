import { test, expect } from '@playwright/test'

/**
 * Unauthenticated surface (no session). Projects `chromium-unauth` and `mobile-unauth`
 * run this file without storageState — see playwright.config.js.
 * Requires backend on localhost:3001 (Vite proxy).
 */
test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => dialog.accept())
})

test.describe('root and auth shell', () => {
  test('GET / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page).toHaveTitle(/Sign in to Hylo|Hylo/)
  })

  test('GET /login shows sign-in form', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: /Sign in to Hylo/i })).toBeVisible()
    await expect(page.getByLabel('email')).toBeVisible()
    await expect(page.getByLabel('password')).toBeVisible()
  })

  test('GET /signup shows welcome sign-up', async ({ page }) => {
    await page.goto('/signup')
    await expect(page).toHaveURL(/\/signup\/?$/)
    await expect(page.getByRole('heading', { name: /Welcome to Hylo/i })).toBeVisible()
    await expect(page.getByLabel('email')).toBeVisible()
  })

  test('GET /reset-password shows reset form', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page).toHaveURL(/\/reset-password$/)
    await expect(page.getByRole('heading', { name: /Reset your password/i })).toBeVisible()
    await expect(
      page.getByText(/Enter your email address and we'll send you an email/i)
    ).toBeVisible()
  })

  test('GET /notifications?token=&name= shows manage notifications', async ({ page }) => {
    await page.goto('/notifications?token=e2e-test-token&name=E2E')
    await expect(page).toHaveURL(/\/notifications/)
    await expect(page).toHaveTitle(/Manage Notifications/i)
    await expect(page.getByRole('heading', { name: /Hi E2E/i })).toBeVisible()
  })
})

test.describe('public layout', () => {
  test('GET /public redirects to /public/groups', async ({ page }) => {
    await page.goto('/public', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/public\/groups$/)
    await expect(page.getByRole('link', { name: /Sign in/i }).first()).toBeVisible()
  })

  test('GET /public/map loads public shell', async ({ page }) => {
    await page.goto('/public/map', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/Public.*Hylo|Hylo/i)
    await expect(page.getByRole('link', { name: /Sign in/i }).first()).toBeVisible()
  })

  test('GET /public/groups loads public shell', async ({ page }) => {
    await page.goto('/public/groups', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/Public.*Hylo|Hylo/i)
    await expect(page.getByRole('link', { name: /Join Hylo/i }).first()).toBeVisible()
  })
})

test.describe('OAuth', () => {
  test('GET /oauth/login/:uid shows OAuth sign-in', async ({ page }) => {
    await page.goto('/oauth/login/e2e-test-uid')
    await expect(page).toHaveURL(/\/oauth\/login\/e2e-test-uid/)
    await expect(page.getByRole('heading', { name: /Sign in to Hylo/i })).toBeVisible()
    await expect(
      page.getByText(/Use your Hylo account to access/i)
    ).toBeVisible()
  })

  test('GET /oauth/consent/:uid shows consent screen', async ({ page }) => {
    await page.goto('/oauth/consent/e2e-test-uid')
    await expect(page).toHaveURL(/\/oauth\/consent\/e2e-test-uid/)
    await expect(
      page.getByRole('heading', { name: /wants access to your Hylo account/i })
    ).toBeVisible()
  })
})

test.describe('public post and post URL redirects', () => {
  test('GET /post/:id settles (non-public post redirects to login with returnToUrl)', async ({ page }) => {
    await page.goto('/post/1', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/post\/1|\/login/, { timeout: 20000 })
    await expect(page).toHaveTitle(/Hylo|Sign in/i, { timeout: 20000 })
  })

  test('GET /all/post/:id redirects to /post/:id', async ({ page }) => {
    const targetId = '999001'
    await page.goto(`/all/post/${targetId}`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(new RegExp(`/post/${targetId}`), { timeout: 15000 })
  })

  test('GET /public/post/:id redirects to /post/:id', async ({ page }) => {
    const targetId = '999002'
    await page.goto(`/public/post/${targetId}`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(new RegExp(`/post/${targetId}`), { timeout: 15000 })
  })

  test('GET /all/topics/topic-a/post/:id redirects to /post/:id', async ({ page }) => {
    const targetId = '999003'
    await page.goto(`/all/topics/topic-a/post/${targetId}`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(new RegExp(`/post/${targetId}`), { timeout: 15000 })
  })
})

test.describe('join and public group', () => {
  test('GET /groups/:slug/join/:code handles invite flow without crashing', async ({ page }) => {
    await page.goto('/groups/e2e-nonexistent-group/join/invalid-invite-code', {
      waitUntil: 'domcontentloaded'
    })
    await expect(page).toHaveURL(/\/signup|\/login/, { timeout: 25000 })
  })

  test('GET /h/use-invitation?token= resolves (invalid token → signup or login)', async ({
    page
  }) => {
    await page.goto('/h/use-invitation?token=e2e-invalid-invite-token', {
      waitUntil: 'domcontentloaded'
    })
    await expect(page).toHaveURL(/\/signup|\/login/, { timeout: 25000 })
  })

  test('GET /groups/:slug/about resolves for non-public slug (often login)', async ({ page }) => {
    await page.goto('/groups/e2e-nonexistent-public-group/about', {
      waitUntil: 'domcontentloaded'
    })
    await expect(page).toHaveURL(/\/login/, { timeout: 25000 })
  })
})

test.describe('unknown path', () => {
  test('unknown route under non-auth layout redirects to /login', async ({ page }) => {
    await page.goto('/totally-unknown-route-xyz')
    await expect(page).toHaveURL(/\/login$/)
  })
})
