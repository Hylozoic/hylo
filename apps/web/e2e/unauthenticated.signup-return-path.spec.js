import { test, expect } from '@playwright/test'
import { spawnSync } from 'child_process'
import dotenv from 'dotenv'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { ensureHyloCookieConsent } from './helpers/sessionAuth.js'
import { PUBLIC_GROUP_SLUG, PAYWALL_GROUP_SLUG, JOIN_LINK_FIXTURES } from './helpers/invitationLinksSeed.js'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

/**
 * A new person who signs up from a link that carries a return path (#1741, growth audit #1628)
 * should land on that path once they have verified their email, registered and finished the
 * welcome wizard. Each run creates a fresh account; the email code is read from the isolated
 * E2E database (no email is sent in CI).
 */

const uiTimeout = { timeout: 60000 }

function e2eDatabaseUrl () {
  const url = new URL(process.env.E2E_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/hylo_e2e_test')
  if (!/test/i.test(url.pathname)) throw new Error(`Refusing to read non-test database ${url.pathname}`)
  return url.toString()
}

function sql (query) {
  const result = spawnSync('psql', [e2eDatabaseUrl(), '-v', 'ON_ERROR_STOP=1', '-tAc', query], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`psql failed: ${result.stderr}`)
  return result.stdout.trim()
}

const quote = value => `'${String(value).replace(/'/g, "''")}'`

function newEmail (testInfo, label) {
  return `e2e-signup-${label}-${testInfo.project.name}-${Date.now()}-${testInfo.retry}@hylo.test`
}

async function signUpFromSignupPage (page, email) {
  const emailInput = page.locator('#email')
  await expect(emailInput).toBeVisible(uiTimeout)
  await emailInput.fill(email)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/signup\/verify-email/, uiTimeout)
  let code = ''
  await expect.poll(() => {
    code = sql(`select code from user_verification_codes where email = ${quote(email)} order by created_at desc limit 1`)
    return code
  }, uiTimeout).toMatch(/^\d{6}$/)
  await page.keyboard.type(code)

  await expect(page).toHaveURL(/\/signup\/agreements/, uiTimeout)
  await page.locator('#accept-agreements').click()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page).toHaveURL(/\/signup\/finish/, uiTimeout)
  await page.locator('#name').fill('E2E Return Path')
  await page.locator('#password').fill('e2e-return-path-pw')
  await page.locator('#passwordConfirmation').fill('e2e-return-path-pw')
  await page.getByRole('button', { name: 'Jump in to Hylo!' }).click()
}

async function finishWelcomeWizard (page) {
  await expect(page).toHaveURL(/\/welcome\/upload-photo/, uiTimeout)
  await page.locator('#continue-button').click()
  await expect(page).toHaveURL(/\/welcome\/add-location/, uiTimeout)
  await page.locator('#continue-button').click()
}

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies()
  await page.goto('about:blank')
  await page.evaluate(() => {
    try {
      window.localStorage.clear()
      window.sessionStorage.clear()
    } catch (e) {}
  })
  await ensureHyloCookieConsent(page)
})

test.describe('Sign up with a return path', () => {
  test.describe.configure({ timeout: 240000 })

  test('a /signup?returnToUrl= link lands on the return path after the welcome wizard', async ({ page }, testInfo) => {
    const returnTo = `/groups/${PUBLIC_GROUP_SLUG}/about`
    await page.goto(`/signup?returnToUrl=${encodeURIComponent(returnTo)}`)
    await waitPastRootSessionLoading(page)
    await signUpFromSignupPage(page, newEmail(testInfo, 'group'))
    await finishWelcomeWizard(page)
    await expect(page).toHaveURL(new RegExp(`${returnTo}$`), uiTimeout)
  })

  test('an email unfollow link survives login -> Sign Up and unfollows after the wizard', async ({ page }, testInfo) => {
    const postId = sql("select id from posts where name = 'E2E Public Post' order by id limit 1")
    await page.goto(`/post/${postId}?action=unfollow`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/login/, uiTimeout)
    await page.getByRole('link', { name: /Not a member of Hylo/ }).click()
    await expect(page).toHaveURL(/\/signup/, uiTimeout)
    await signUpFromSignupPage(page, newEmail(testInfo, 'unfollow'))
    await finishWelcomeWizard(page)
    await expect(page).toHaveURL(new RegExp(`/post/${postId}`), uiTimeout)
    await expect(page.getByText("You won't get notifications for new comments on this post")).toBeVisible(uiTimeout)
  })

  test('Join Hylo on a public post page comes back to the post', async ({ page }, testInfo) => {
    const postId = sql("select id from posts where name = 'E2E Public Post' order by id limit 1")
    await page.goto(`/post/${postId}`)
    await waitPastRootSessionLoading(page)
    await page.getByRole('link', { name: 'Join Hylo' }).click()
    await expect(page).toHaveURL(/\/signup/, uiTimeout)
    await signUpFromSignupPage(page, newEmail(testInfo, 'publicpost'))
    await finishWelcomeWizard(page)
    await expect(page).toHaveURL(new RegExp(`/post/${postId}$`), uiTimeout)
  })

  test('Sign up to Purchase on a paywalled group comes back to the paywall', async ({ page }, testInfo) => {
    await page.goto(`/groups/${PAYWALL_GROUP_SLUG}`)
    await waitPastRootSessionLoading(page)
    await page.getByRole('button', { name: /Sign up to Purchase/i }).click()
    await expect(page).toHaveURL(/\/signup/, uiTimeout)
    await signUpFromSignupPage(page, newEmail(testInfo, 'paywall'))
    await finishWelcomeWizard(page)
    await expect(page.getByRole('heading', { name: /This group requires a fee to join/i })).toBeVisible(uiTimeout)
    await expect(page.getByRole('button', { name: /Purchase Access/i })).toBeVisible(uiTimeout)
    await expect(page).toHaveURL(new RegExp(`/groups/${PAYWALL_GROUP_SLUG}`), uiTimeout)
  })

  test('Signup or Login on a public group about page comes back to the group', async ({ page }, testInfo) => {
    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/about`)
    await waitPastRootSessionLoading(page)
    await page.getByRole('link', { name: /Signup or Login to connect with/i }).click()
    await expect(page).toHaveURL(/\/login/, uiTimeout)
    await page.getByRole('link', { name: /Not a member of Hylo/ }).click()
    await expect(page).toHaveURL(/\/signup/, uiTimeout)
    await signUpFromSignupPage(page, newEmail(testInfo, 'aboutgate'))
    await finishWelcomeWizard(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${PUBLIC_GROUP_SLUG}/about$`), uiTimeout)
  })

  test('the emailed verification link carries the return path to another browser', async ({ page, browser }, testInfo) => {
    const returnTo = `/groups/${PUBLIC_GROUP_SLUG}/about`
    const email = newEmail(testInfo, 'emaillink')
    await page.goto(`/signup?returnToUrl=${encodeURIComponent(returnTo)}`)
    await waitPastRootSessionLoading(page)
    await page.locator('#email').fill(email)
    const sendRequest = page.waitForRequest(req => req.url().includes('/noo/graphql') && (req.postData() || '').includes('SendEmailVerification'))
    await page.getByRole('button', { name: 'Create account' }).click()
    // The backend puts this returnToUrl on the emailed link (api/graphql/mutations/user.test.js)
    expect((await sendRequest).postDataJSON().variables.returnToUrl).toBe(returnTo)
    await expect(page).toHaveURL(/\/signup\/verify-email/, uiTimeout)
    let code = ''
    await expect.poll(() => {
      code = sql(`select code from user_verification_codes where email = ${quote(email)} order by created_at desc limit 1`)
      return code
    }, uiTimeout).toMatch(/^\d{6}$/)

    // Open the link somewhere with no stored return path (another browser or device)
    const otherBrowser = await browser.newContext({ ...testInfo.project.use, storageState: { cookies: [], origins: [] } })
    try {
      const tab = await otherBrowser.newPage()
      await ensureHyloCookieConsent(tab)
      // The emailed link, with the code typed instead of the signed token
      await tab.goto(`/signup/verify-email?email=${encodeURIComponent(email)}&returnToUrl=${encodeURIComponent(returnTo)}`)
      await waitPastRootSessionLoading(tab)
      await expect(tab).not.toHaveURL(/returnToUrl/, uiTimeout)
      await tab.keyboard.type(code)
      await expect(tab).toHaveURL(/\/signup\/agreements/, uiTimeout)
      await tab.locator('#accept-agreements').click()
      await tab.getByRole('button', { name: 'Continue' }).click()
      await expect(tab).toHaveURL(/\/signup\/finish/, uiTimeout)
      await tab.locator('#name').fill('E2E Return Path')
      await tab.locator('#password').fill('e2e-return-path-pw')
      await tab.locator('#passwordConfirmation').fill('e2e-return-path-pw')
      await tab.getByRole('button', { name: 'Jump in to Hylo!' }).click()
      await finishWelcomeWizard(tab)
      await expect(tab).toHaveURL(new RegExp(`${returnTo}$`), uiTimeout)
    } finally {
      await otherBrowser.close()
    }
  })

  test('an invitation join link still lands on the group about page', async ({ page }, testInfo) => {
    const fixture = JOIN_LINK_FIXTURES[0]
    await page.goto(`/groups/${fixture.slug}/join/${fixture.accessCode}`)
    await waitPastRootSessionLoading(page)
    await expect(page).toHaveURL(/\/signup/, uiTimeout)
    await signUpFromSignupPage(page, newEmail(testInfo, 'invite'))
    await finishWelcomeWizard(page)
    await expect(page).toHaveURL(new RegExp(`/groups/${fixture.slug}/about`), uiTimeout)
  })
})
