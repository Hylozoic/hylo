import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * D58: the one-tap answers to the open request nudge, on a request the signed-in e2e
 * user posts in the seeded `e2e-public-group` for each run:
 * - ?nudge=open-request asks the author whether it's still needed
 * - ?action=still-needed keeps it open, thanks them and leaves the address clean
 * - ?action=met marks it met through the usual fulfill
 * Screenshots land in e2e/screenshots/, named per project.
 */

test.describe.configure({ timeout: 120000 })

const uiTimeout = { timeout: 60000 }
const GROUP_SLUG = 'e2e-public-group'
const shot = name => `e2e/screenshots/${test.info().project.name}-${name}.png`

async function graphql (page, query, variables = {}) {
  return page.evaluate(async ({ query, variables }) => {
    const response = await fetch('/noo/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    })
    return response.json()
  }, { query, variables })
}

async function postRequest (page) {
  const group = await graphql(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: GROUP_SLUG })
  const title = `Need a ladder ${Date.now()}`
  const created = await graphql(page, 'mutation ($data: PostInput) { createPost(data: $data) { id } }', {
    data: { title, details: '<p>Just for an afternoon</p>', type: 'request', groupIds: [group.data.group.id] }
  })
  expect(created.errors).toBeUndefined()
  return { id: created.data.createPost.id, title }
}

test.describe('Open request answers', () => {
  test('the nudge asks, and "Still needed" keeps the request open', async ({ page }) => {
    await page.goto(`/groups/${GROUP_SLUG}/all`)
    await waitPastRootSessionLoading(page)
    const request = await postRequest(page)

    await page.goto(`/groups/${GROUP_SLUG}/post/${request.id}?nudge=open-request`)
    await waitPastRootSessionLoading(page)
    const prompt = page.getByTestId('open-request-prompt')
    await expect(prompt).toBeVisible(uiTimeout)
    await page.screenshot({ path: shot('open-request-prompt') })

    await prompt.getByRole('button', { name: 'Still needed' }).click()
    await expect(page.getByText('Thanks! It stays open so people can still help.')).toBeVisible(uiTimeout)
    await expect(page).not.toHaveURL(/action=/)
    await expect(page).not.toHaveURL(/nudge=/)
    await expect(prompt).toBeHidden()
    await page.screenshot({ path: shot('open-request-still-needed') })
  })

  test('?action=met marks the request as met once', async ({ page }) => {
    await page.goto(`/groups/${GROUP_SLUG}/all`)
    await waitPastRootSessionLoading(page)
    const request = await postRequest(page)

    await page.goto(`/groups/${GROUP_SLUG}/post/${request.id}?action=met`)
    // The toast shows for a few seconds as soon as the post loads, which can be over before
    // waitPastRootSessionLoading returns, so look for it straight away
    await expect(page.getByText('Marked as met. Thanks for letting everyone know!')).toBeVisible(uiTimeout)
    await expect(page).not.toHaveURL(/action=/)

    const post = await graphql(page, 'query ($id: ID) { post(id: $id) { id fulfilledAt } }', { id: request.id })
    expect(post.data.post.fulfilledAt).toBeTruthy()
    await page.screenshot({ path: shot('open-request-met') })
  })
})
