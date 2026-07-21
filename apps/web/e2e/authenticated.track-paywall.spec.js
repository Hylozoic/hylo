import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch P3 — access-controlled track + Stripe offering (member without Coordinator bypass).
 * Seed: `E2E Paid Track`, offering `E2E Track Access Monthly`, user `e2e.track-viewer@hylo.test`.
 */

test.describe.configure({ timeout: 120000 })

const uiTimeout = { timeout: 60000 }

const PUBLIC_GROUP_SLUG = 'e2e-public-group'
const PAID_TRACK_NAME = 'E2E Paid Track'
const TRACK_OFFERING_NAME = 'E2E Track Access Monthly'

/**
 * Track DB id is sequence-dependent; resolve via GraphQL after login.
 * @param {import('@playwright/test').Page} page
 * @param {string} groupSlug
 * @param {string} trackName
 */
async function fetchTrackIdByName (page, groupSlug, trackName) {
  return page.evaluate(
    async ({ slug, name }) => {
      const res = await fetch('/noo/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: `query ($slug: String) {
            group(slug: $slug) {
              tracks(first: 30, published: true) {
                items { id name }
              }
            }
          }`,
          variables: { slug }
        })
      })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(`GraphQL HTTP ${res.status}: ${text.slice(0, 240)}`)
      }
      let json
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error(`GraphQL non-JSON (API down or proxy error): ${text.slice(0, 240)}`)
      }
      const items = json?.data?.group?.tracks?.items || []
      const row = items.find(i => i.name === name)
      return row?.id ?? null
    },
    { slug: groupSlug, name: trackName }
  )
}

test.describe('Batch P3: track paywall (track viewer)', () => {
  test('published access-controlled track shows fee and purchase affordances', async ({ page }) => {
    await page.goto('/')
    await waitPastRootSessionLoading(page)

    const trackId = await fetchTrackIdByName(page, PUBLIC_GROUP_SLUG, PAID_TRACK_NAME)
    expect(trackId).toBeTruthy()

    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/tracks/${trackId}`)
    await waitPastRootSessionLoading(page)

    await expect(page.getByRole('heading', { name: /This track requires a fee to access/i })).toBeVisible(uiTimeout)
    await expect(page.getByText(TRACK_OFFERING_NAME)).toBeVisible(uiTimeout)
    await expect(page.getByRole('button', { name: /Purchase Access/i })).toBeVisible(uiTimeout)
  })
})
