import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Unauthenticated surface (no session). Projects `chromium-unauth` and `mobile-unauth`
 * use empty storageState — see playwright.config.js.
 * With `yarn test:e2e*`, isolated API + Playwright-spawned Vite proxy (`VITE_API_HOST`).
 */
test.beforeEach(async ({ context, page }, testInfo) => {
  await context.clearCookies()
  // Cookies-only clearing leaves Redux persist / localStorage — RootRouter can stay “logged in” at /
  await page.goto('about:blank')
  await page.evaluate(() => {
    try {
      window.localStorage.clear()
      window.sessionStorage.clear()
    } catch (e) {}
  })
  page.on('dialog', (dialog) => dialog.accept())
  if (process.env.E2E_FORWARD_BROWSER_LOGS === '1') {
    const label = `[${testInfo.project.name}] ${testInfo.titlePath.join(' › ')}`
    page.on('console', msg => {
      const t = msg.text()
      if (t.includes('[Hylo') || t.includes('GraphQL')) {
        process.stderr.write(`[browser] ${label} | ${t}\n`)
      }
    })
  }
})

/** After session gate: i18n + layout (cold isolated stack + parallel workers) */
const uiTimeout = { timeout: 60000 }
const routeTimeout = { timeout: 60000 }

test.describe('root and auth shell', () => {
  test('GET / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/login$/, routeTimeout)
    await expect(page).toHaveTitle(/Sign in to Hylo|Hylo/, uiTimeout)
  })

  test('GET /login shows sign-in form', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login$/, routeTimeout)
    await waitPastRootSessionLoading(page)
    await expect(page.getByRole('heading', { name: /Sign in to Hylo/i })).toBeVisible(uiTimeout)
    await expect(page.locator('#email')).toBeVisible(uiTimeout)
    await expect(page.locator('#password')).toBeVisible(uiTimeout)
  })

  test('GET /signup shows welcome sign-up', async ({ page }) => {
    await page.goto('/signup')
    await expect(page).toHaveURL(/\/signup\/?$/, routeTimeout)
    await waitPastRootSessionLoading(page)
    await expect(page.getByRole('heading', { name: /Welcome to Hylo/i })).toBeVisible(uiTimeout)
    await expect(page.locator('#email')).toBeVisible(uiTimeout)
  })

  test('GET /reset-password shows reset form', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page).toHaveURL(/\/reset-password$/, routeTimeout)
    await waitPastRootSessionLoading(page)
    await expect(page.getByRole('heading', { name: /Reset your password/i })).toBeVisible(uiTimeout)
    await expect(
      page.getByText(/Enter your email address and we'll send you an email/i)
    ).toBeVisible(uiTimeout)
  })

  test('GET /notifications?token=&name= shows manage notifications', async ({ page }) => {
    test.skip(
      !process.env.E2E_NOTIFICATION_PAGE_JWT,
      'Isolated E2E mints this when OIDC_KEYS is set (apps/backend/.env); or set E2E_NOTIFICATION_PAGE_JWT'
    )
    const token = process.env.E2E_NOTIFICATION_PAGE_JWT
    await page.goto(`/notifications?token=${encodeURIComponent(token)}&name=E2E`)
    await expect(page).toHaveURL(/\/notifications/, routeTimeout)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveTitle(/Manage Notifications/i, uiTimeout)
    await expect(page.getByRole('heading', { name: /Hi E2E/i })).toBeVisible(uiTimeout)
  })
})

test.describe('public layout', () => {
  test('GET /public redirects to /public/groups', async ({ page }) => {
    await page.goto('/public', { waitUntil: 'domcontentloaded' })
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/public\/groups$/, routeTimeout)
    await expect(page.getByRole('link', { name: /Sign in/i }).first()).toBeVisible(uiTimeout)
  })

  test('GET /public/map loads public shell', async ({ page }) => {
    await page.goto('/public/map', { waitUntil: 'domcontentloaded' })
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveTitle(/Public.*Hylo|Hylo/i, uiTimeout)
    await expect(page.getByRole('link', { name: /Sign in/i }).first()).toBeVisible(uiTimeout)
  })

  test('GET /public/groups loads public shell', async ({ page }) => {
    await page.goto('/public/groups', { waitUntil: 'domcontentloaded' })
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveTitle(/Public.*Hylo|Hylo/i, uiTimeout)
    await expect(page.getByRole('link', { name: /Join Hylo/i }).first()).toBeVisible(uiTimeout)
  })
})

test.describe('OAuth', () => {
  test('GET /oauth/login/:uid shows OAuth sign-in', async ({ page }) => {
    await page.goto('/oauth/login/e2e-test-uid')
    await expect(page).toHaveURL(/\/oauth\/login\/e2e-test-uid/, routeTimeout)
    await waitPastRootSessionLoading(page)
    await expect(page.getByRole('heading', { name: /Sign in to Hylo/i })).toBeVisible(uiTimeout)
    await expect(
      page.getByText(/Use your Hylo account to access/i)
    ).toBeVisible(uiTimeout)
  })

  test('GET /oauth/consent/:uid shows consent screen', async ({ page }) => {
    await page.goto('/oauth/consent/e2e-test-uid')
    await expect(page).toHaveURL(/\/oauth\/consent\/e2e-test-uid/, routeTimeout)
    await waitPastRootSessionLoading(page)
    await expect(
      page.getByRole('heading', { name: /wants access to your Hylo account/i })
    ).toBeVisible(uiTimeout)
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
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/login$/, routeTimeout)
  })
})

test.describe('email password login (cold storage)', () => {
  test('seeded user can sign in and reach auth shell', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await waitPastRootSessionLoading(page)
    await expect(page.locator('#email')).toBeVisible(uiTimeout)
    await page.locator('#email').fill('e2e.user@hylo.test')
    await page.locator('#password').fill('e2e-password-123')
    await page.getByRole('button', { name: /sign\s*in/i }).click()
    await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 120000 })
  })

  test('wrong password keeps user on login with error', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#email')).toBeVisible(uiTimeout)
    await page.locator('#email').fill('e2e.user@hylo.test')
    await page.locator('#password').fill('definitely-wrong-password-e2e')
    await page.getByRole('button', { name: /sign\s*in/i }).click()
    await expect(
      page.getByText(/sorry.*email and password combination|didn.*work/i)
    ).toBeVisible({ timeout: 20000 })
    await expect(page).toHaveURL(/\/login/, routeTimeout)
  })
})
