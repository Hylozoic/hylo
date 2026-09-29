import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { ensureHyloCookieConsent } from './helpers/sessionAuth.js'
import { PUBLIC_GROUP_SLUG, PRIVATE_GROUP_SLUG } from './helpers/invitationLinksSeed.js'

/**
 * Signed-out visitors to a members-only post (D19):
 * - post only in a Hidden group → generic "This post is in a private group" page
 * - post in a group with a public About page → teaser naming the group
 *
 * Runs in the signed-in `chromium` project: the signed-in `request` creates two
 * members-only posts (the seeded posts are all public), then a fresh signed-out
 * context opens them. Screenshots land in test-results for the PR.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }

async function graphql (request, query, variables = {}) {
  const response = await request.post('/noo/graphql', { data: { query, variables } })
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  expect(body.errors, JSON.stringify(body.errors)).toBeUndefined()
  return body.data
}

async function createMembersOnlyPost (request, groupSlug, title) {
  const { group } = await graphql(request, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: groupSlug })
  const { createPost } = await graphql(request,
    'mutation ($data: PostInput) { createPost(data: $data) { id } }',
    { data: { type: 'discussion', title, details: '<p>Members only</p>', groupIds: [group.id], isPublic: false } }
  )
  return createPost.id
}

async function signedOutPage (browser) {
  // browser.newContext doesn't inherit the project's `use` options
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: { cookies: [], origins: [] }
  })
  const page = await context.newPage()
  await ensureHyloCookieConsent(page)
  return { context, page }
}

test('a members-only post in a hidden group shows the private-group page', async ({ browser, request }, testInfo) => {
  const postId = await createMembersOnlyPost(request, PRIVATE_GROUP_SLUG, `E2E hidden group post ${Date.now()}`)
  const { context, page } = await signedOutPage(browser)

  await page.goto(`/post/${postId}`)
  await waitPastRootSessionLoading(page)

  await expect(page.getByTestId('private-post-teaser')).toBeVisible(uiTimeout)
  await expect(page.getByRole('heading', { name: 'This post is in a private group' })).toBeVisible(uiTimeout)
  await expect(page.getByText('E2E Private Group')).toHaveCount(0)
  const returnTo = encodeURIComponent(`/post/${postId}`)
  await expect(page.getByRole('link', { name: 'Sign up', exact: true })).toHaveAttribute('href', `/signup?returnToUrl=${returnTo}`)
  await expect(page.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', `/login?returnToUrl=${returnTo}`)

  await page.screenshot({ path: testInfo.outputPath('private-post-generic.png'), fullPage: true })
  await context.close()
})

test('a members-only post in a public group shows the group teaser', async ({ browser, request }, testInfo) => {
  const postId = await createMembersOnlyPost(request, PUBLIC_GROUP_SLUG, `E2E public group post ${Date.now()}`)
  const { context, page } = await signedOutPage(browser)

  await page.goto(`/post/${postId}`)
  await waitPastRootSessionLoading(page)

  await expect(page.getByTestId('private-post-teaser-group')).toBeVisible(uiTimeout)
  await expect(page.getByRole('heading', { name: 'This post is in E2E Public Group' })).toBeVisible(uiTimeout)
  await expect(page.getByRole('link', { name: 'Sign up to request access' }))
    .toHaveAttribute('href', `/signup?returnToUrl=${encodeURIComponent(`/groups/${PUBLIC_GROUP_SLUG}`)}`)

  await page.screenshot({ path: testInfo.outputPath('private-post-group-teaser.png'), fullPage: true })
  await context.close()
})
