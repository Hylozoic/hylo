import { test, expect } from '@playwright/test'
import crypto from 'crypto'
import { spawnSync } from 'child_process'
import dotenv from 'dotenv'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

/**
 * Changing the account email (#1602): the new address only takes effect once the code sent to it is entered.
 * The code only goes out by email, so the test sets a known code hash on the pending change directly in the
 * isolated E2E database.
 */

const KNOWN_CODE = '135790'
const uiTimeout = { timeout: 60000 }

function e2eDatabaseUrl () {
  const url = new URL(process.env.E2E_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/hylo_e2e_test')
  if (!/test/i.test(url.pathname)) throw new Error(`Refusing to modify non-test database ${url.pathname}`)
  return url.toString()
}

function sql (query) {
  const result = spawnSync('psql', [e2eDatabaseUrl(), '-v', 'ON_ERROR_STOP=1', '-tAc', query], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`psql failed: ${result.stderr}`)
  return result.stdout.trim()
}

const quote = value => `'${String(value).replace(/'/g, "''")}'`

test.describe('Account email change', () => {
  // All steps act on the one shared E2E user, so run once, in order
  test.describe.configure({ mode: 'serial', timeout: 180000 })

  const runId = Date.now()
  const newEmail = `e2e-email-change-${runId}@hylo.test`
  // A fresh current address per run, so the per-address request limit (kept in Redis across runs) isn't hit
  const originalEmail = `e2e-email-original-${runId}@hylo.test`
  let seedEmail

  test.beforeEach(({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Changes the shared E2E user, so only runs on one project')
  })

  test.afterAll(() => {
    if (!seedEmail) return
    sql(`update users set email = ${quote(seedEmail)}, settings = settings - 'pending_email' where email in (${quote(originalEmail)}, ${quote(newEmail)})`)
  })

  test('keeps the current email until the new one is verified', async ({ page }, testInfo) => {
    await page.goto('/my/account')
    await waitPastRootSessionLoading(page)

    const emailInput = page.getByLabel('Email', { exact: true })
    await expect(emailInput).not.toHaveValue('', uiTimeout)
    seedEmail = await emailInput.inputValue()
    sql(`update users set email = ${quote(originalEmail)} where email = ${quote(seedEmail)}`)
    await page.reload()
    await waitPastRootSessionLoading(page)
    await expect(emailInput).toHaveValue(originalEmail, uiTimeout)

    // Request, then cancel
    await emailInput.fill(newEmail)
    await page.getByRole('button', { name: 'Save Changes' }).click()
    const pending = page.getByTestId('pending-email-change')
    await expect(pending).toBeVisible(uiTimeout)
    await pending.getByText('Cancel email change').click()
    await expect(pending).toBeHidden(uiTimeout)
    await expect(emailInput).toHaveValue(originalEmail)

    // Request again
    await emailInput.fill(newEmail)
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText(`We sent a verification code to ${newEmail}`)).toBeVisible(uiTimeout)
    await expect(pending).toContainText(newEmail)
    await expect(pending).toContainText(originalEmail)
    await expect(emailInput).toHaveValue(originalEmail)

    // Still pending after a reload, and the account still has the old email
    await page.reload()
    await waitPastRootSessionLoading(page)
    await expect(pending).toBeVisible(uiTimeout)
    await expect(emailInput).toHaveValue(originalEmail)
    expect(sql(`select count(*) from users where lower(email) = lower(${quote(originalEmail)})`)).toBe('1')
    await page.screenshot({ path: testInfo.outputPath('issue-1602-pending.png'), fullPage: false })

    // A wrong code is rejected
    const codeInput = pending.getByLabel('Verification code')
    await codeInput.focus()
    await page.keyboard.type(KNOWN_CODE)
    await expect(page.getByText('Invalid code, please try again')).toBeVisible(uiTimeout)
    await expect(emailInput).toHaveValue(originalEmail)

    // The real code only goes out by email, so give the pending change a known one
    const codeHash = crypto.createHash('sha256').update(KNOWN_CODE).digest('hex')
    sql(`update users set settings = jsonb_set(settings, '{pending_email,code_hash}', to_jsonb(${quote(codeHash)}::text)) where lower(email) = lower(${quote(originalEmail)})`)

    await codeInput.focus()
    await page.keyboard.type(KNOWN_CODE)
    await expect(page.getByText(`Your email address is now ${newEmail}`)).toBeVisible(uiTimeout)
    await expect(pending).toBeHidden(uiTimeout)
    await expect(emailInput).toHaveValue(newEmail)
    expect(sql(`select count(*) from users where email = ${quote(newEmail)} and email_validated`)).toBe('1')
    await page.screenshot({ path: testInfo.outputPath('issue-1602-verified.png'), fullPage: false })
  })

  test('reports a bad verification link and drops it from the URL', async ({ page }) => {
    await page.goto('/my/account?emailChangeToken=not-a-real-token')
    await waitPastRootSessionLoading(page)
    await expect(page.getByText('Link expired, please start over')).toBeVisible(uiTimeout)
    await expect(page).toHaveURL(/\/my\/account$/)
  })
})
