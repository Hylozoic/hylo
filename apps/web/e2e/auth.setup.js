import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const authFile = path.resolve(import.meta.dirname, '.auth/session.json')
const E2E_LOGIN_EMAIL = 'e2e.user@hylo.test'
const E2E_LOGIN_PASSWORD = 'e2e-password-123'

/** RootRouter blocks on checkLogin; Login mounts `#email` only after. */
const GOTO_TIMEOUT_MS = 60000
const LOGIN_FORM_TIMEOUT_MS = 120000
/** AuthLayoutRouter bootstrap (`fetchForCurrentUser` + roles); shell mounts `#center-column-container` after this. */
const AUTH_BOOTSTRAP_MS = 120000

const shouldDiag = () => process.env.CI === 'true' || process.env.E2E_FORWARD_BROWSER_LOGS === '1'

/**
 * GraphQL responses with errors or non-OK status — surfaces missing backend env / resolver failures in CI.
 * @param {import('@playwright/test').Page} page
 */
function attachGraphqlDiagnostics (page) {
  if (!shouldDiag()) return
  page.on('response', async response => {
    const url = response.url()
    if (!url.includes('/noo/graphql')) return
    const req = response.request()
    const postData = req.postData() || ''
    try {
      const text = await response.text()
      const status = response.status()
      if (status !== 200) {
        process.stderr.write(
          `[e2e][graphql] ${status} ${url}\nbody (truncated): ${text.slice(0, 1500)}\npost (truncated): ${postData.slice(0, 800)}\n`
        )
        return
      }
      let json
      try {
        json = JSON.parse(text)
      } catch {
        return
      }
      if (json.errors?.length) {
        process.stderr.write(
          `[e2e][graphql] 200 ${url}\nerrors: ${JSON.stringify(json.errors).slice(0, 2500)}\npost (truncated): ${postData.slice(0, 800)}\n`
        )
      }
    } catch (e) {
      process.stderr.write(`[e2e][graphql] read error: ${e.message}\n`)
    }
  })
}

/**
 * Forwards browser logs; expands console args so rollbar / action errors are not just "Object".
 * @param {import('@playwright/test').Page} page
 */
function forwardBrowserLogsForSetup (page) {
  if (!shouldDiag()) return
  page.on('console', async msg => {
    const type = msg.type()
    const text = msg.text()
    if (
      type !== 'error' &&
      !text.includes('[Hylo') &&
      !text.includes('GraphQL') &&
      !text.includes('auth bootstrap') &&
      !text.includes('action error for')
    ) {
      return
    }
    const parts = []
    for (const arg of msg.args()) {
      try {
        const v = await arg.jsonValue()
        parts.push(typeof v === 'object' && v !== null ? JSON.stringify(v).slice(0, 4000) : String(v))
      } catch {
        try {
          parts.push(String(await arg.evaluate(o => {
            try {
              return JSON.stringify(o)
            } catch {
              return String(o)
            }
          })))
        } catch {
          parts.push(text)
        }
      }
    }
    process.stderr.write(`[browser][auth.setup] ${parts.join(' ')}\n`)
  })
  page.on('pageerror', err => {
    process.stderr.write(`[browser][auth.setup] pageerror: ${err.message}\n${err.stack || ''}\n`)
  })
}

setup('authenticate', async ({ page }) => {
  attachGraphqlDiagnostics(page)
  forwardBrowserLogsForSetup(page)

  // `domcontentloaded` avoids rare hangs where dev/HMR keeps `load` from settling before React mounts.
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: GOTO_TIMEOUT_MS })
  await expect(page).toHaveURL(/\/login/)

  const emailInput = page.locator('#email')
  await expect(emailInput).toBeVisible({ timeout: LOGIN_FORM_TIMEOUT_MS })

  await emailInput.fill(E2E_LOGIN_EMAIL)
  await page.locator('#password').fill(E2E_LOGIN_PASSWORD)

  await page.getByRole('button', { name: /sign\s*in/i }).click()

  // After password login the URL often stays `/login` while RootRouter swaps to AuthLayoutRouter (`path='*'`).
  // Bootstrap shows `data-testid='loading-screen'` only while `fetchForCurrentUser` runs; on fast CI that
  // can unmount before Playwright observes it, so wait for the main shell instead.
  const authShell = page.locator('#center-column-container')
  await expect(authShell).toBeVisible({ timeout: AUTH_BOOTSTRAP_MS })

  console.log('Authenticated successfully')

  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  await page.context().storageState({ path: authFile })
})
