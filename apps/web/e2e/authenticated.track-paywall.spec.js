import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Batch P3 — paid track space (member without Coordinator / Administration).
 * Seed: `E2E Paid Track` space with paywall + offering granting that space.
 * User: `e2e.track-viewer@hylo.test`.
 */

test.describe.configure({ timeout: 120000 })

const uiTimeout = { timeout: 60000 }

const PUBLIC_GROUP_SLUG = 'e2e-public-group'
const PAID_TRACK_NAME = 'E2E Paid Track'

/**
 * Resolve Track space slug via GraphQL after login.
 * @param {import('@playwright/test').Page} page
 * @param {string} groupSlug
 * @param {string} trackName
 */
async function fetchTrackSpaceSlug (page, groupSlug, trackName) {
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
                items {
                  id
                  name
                  space { id slug }
                }
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
      return row?.space?.slug ?? null
    },
    { slug: groupSlug, name: trackName }
  )
}

test.describe('Batch P3: paid space paywall (track viewer)', () => {
  test('paywalled track space shows offerings on join interstitial', async ({ page }) => {
    await page.goto('/')
    await waitPastRootSessionLoading(page)

    const spaceSlug = (await fetchTrackSpaceSlug(page, PUBLIC_GROUP_SLUG, PAID_TRACK_NAME)) || 'e2e-paid-track-space'
    expect(spaceSlug).toBeTruthy()

    const localSlug = spaceSlug.startsWith(`${PUBLIC_GROUP_SLUG}-`)
      ? spaceSlug.slice(PUBLIC_GROUP_SLUG.length + 1)
      : spaceSlug

    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/spaces/${localSlug}/track-actions`)
    await waitPastRootSessionLoading(page)

    await expect(page.getByText(/Pay to Join Space/i)).toBeVisible(uiTimeout)
    await expect(page.getByText(/E2E Track Access Monthly/i)).toBeVisible(uiTimeout)
  })
})
