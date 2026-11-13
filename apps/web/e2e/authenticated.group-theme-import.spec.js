import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * "Start from a website" in the group theme editor, in a real logged-in
 * session. The import mutation's response is stubbed, so no headless browser or
 * AI model runs: this checks that a suggestion fills the draft without saving
 * and that the token and cost meter shows what the server reported.
 * Requires the E2E seed's Administrator role for the login user on e2e-public-group.
 */

test.describe.configure({ timeout: 180000 })

const GROUP_SLUG = 'e2e-public-group'
const uiTimeout = { timeout: 60000 }

const suggestion = {
  roles: {
    light: { background: '#f8f9fa', card: '#ffffff', text: '#202122', primary: '#3366cc', accent: '#3366cc', selected: '#dce5f5' },
    dark: { background: '#101418', card: '#1b2026', text: '#eaecf0', primary: '#6b9bff', accent: '#6b9bff', selected: '#27406b' }
  },
  radius: 'sm',
  borderWidth: 'thin',
  fontHeading: 'Lora',
  fontBody: null,
  summary: 'Restrained and encyclopedic.',
  sourceUrl: 'https://www.wikipedia.org/',
  usage: {
    model: 'claude-opus-5-5',
    inputTokens: 5586,
    outputTokens: 260,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    estimatedCostUsd: 0.027544,
    pricePerMillionTokens: { input: 4, output: 20 }
  }
}

test.describe('group theme import from a website', () => {
  test.skip(({ isMobile }) => isMobile, 'The editor flow is covered on desktop')

  test('fills the draft and shows tokens and cost', async ({ page }) => {
    await page.route('**/noo/graphql', async route => {
      const body = route.request().postData() || ''
      if (!body.includes('ImportGroupThemeFromUrl')) return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { importGroupThemeFromUrl: suggestion } })
      })
    })

    await page.goto(`/groups/${GROUP_SLUG}/settings/appearance`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByTestId('group-theme-editor')).toBeVisible(uiTimeout)

    const meter = page.getByTestId('group-theme-import-usage')
    await expect(meter).toContainText('Each import costs about $0.03')

    await page.getByLabel('Start from a website').fill('wikipedia.org')
    await page.getByRole('button', { name: 'Import look' }).click()

    await expect(page.getByTestId('group-theme-import-summary')).toContainText('Restrained and encyclopedic.', uiTimeout)
    await expect(meter).toContainText('This import: 5,586 input and 260 output tokens, about $0.028')
    await expect(meter).toContainText('This visit: 1 imports, 5,846 tokens')
    await expect(meter).toContainText('claude-opus-5-5')

    // The suggestion is a draft: previewed on the page, not saved
    await expect(page.locator('style#group-theme-preview')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Save theme' })).toBeEnabled()
    await meter.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'e2e-screenshots/group-theme-import-meter.png' })
  })
})
