import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * D33 and D63, on a free track the signed-in e2e user (a steward of the seeded
 * `e2e-public-group`) creates in that group for each run, with three actions, enrolls
 * in and completes one of:
 * - the learner sees "1 of 3 completed" at the top of the actions, and a
 *   "Next: <title>" button on the completed action
 * - the steward sees each learner's N of M in the track's members view, with the
 *   Not finished filter
 * Screenshots land in e2e/screenshots/, named per project.
 */

test.describe.configure({ timeout: 180000 })

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

const expectOk = result => {
  expect(result.errors).toBeUndefined()
  return result.data
}

async function createTrackWithActions (page) {
  const { group } = expectOk(await graphql(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: GROUP_SLUG }))
  const stamp = Date.now().toString(36)
  const { createSpace: space } = expectOk(await graphql(page, `mutation ($parentGroupId: ID!, $name: String!, $slug: String, $viewTypes: [String], $status: GroupStatus) {
    createSpace(parentGroupId: $parentGroupId, name: $name, slug: $slug, viewTypes: $viewTypes, status: $status) { id slug }
  }`, { parentGroupId: group.id, name: `Progress track ${stamp}`, slug: `progress-${stamp}`, viewTypes: ['track-actions', 'members'], status: 'published' }))
  const { createTrack: track } = expectOk(await graphql(page, 'mutation ($data: TrackInput) { createTrack(data: $data) { id } }', { data: { groupId: space.id } }))
  const actions = []
  for (const title of ['Watch the intro', 'Build a bin', 'Share a photo']) {
    const { createPost: action } = expectOk(await graphql(page, 'mutation ($data: PostInput) { createPost(data: $data) { id title } }', {
      data: { title, type: 'action', groupIds: [space.id], trackId: track.id, completionAction: 'button' }
    }))
    actions.push(action)
  }
  expectOk(await graphql(page, 'mutation ($trackId: ID) { enrollInTrack(trackId: $trackId) { id } }', { trackId: track.id }))
  expectOk(await graphql(page, 'mutation ($postId: ID, $completionResponse: JSON) { completePost(postId: $postId, completionResponse: $completionResponse) { id } }', {
    postId: actions[0].id,
    completionResponse: []
  }))
  const localSlug = space.slug.startsWith(`${GROUP_SLUG}-`) ? space.slug.slice(GROUP_SLUG.length + 1) : space.slug
  return { space, track, actions, spacePath: `/groups/${GROUP_SLUG}/spaces/${localSlug}` }
}

test.describe('Track progress', () => {
  test('the learner sees their progress and the next action', async ({ page }) => {
    await page.goto(`/groups/${GROUP_SLUG}/all`)
    await waitPastRootSessionLoading(page)
    const { actions, spacePath } = await createTrackWithActions(page)

    await page.goto(`${spacePath}/track-actions`)
    await waitPastRootSessionLoading(page)
    const progress = page.getByTestId('track-progress').first()
    await expect(progress).toContainText('1 of 3 completed', uiTimeout)
    await page.screenshot({ path: shot('track-progress-bar') })

    await page.goto(`${spacePath}/track-actions/post/${actions[0].id}`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByTestId('next-action')).toContainText('Next: Build a bin', uiTimeout)
    await page.screenshot({ path: shot('track-next-action') })
  })

  test('the steward sees each learner\'s progress, not finished first', async ({ page }) => {
    await page.goto(`/groups/${GROUP_SLUG}/all`)
    await waitPastRootSessionLoading(page)
    const { spacePath } = await createTrackWithActions(page)

    await page.goto(`${spacePath}/members`)
    await waitPastRootSessionLoading(page)
    const panel = page.getByTestId('track-progress-panel')
    await expect(panel).toBeVisible(uiTimeout)
    await expect(panel.getByRole('button', { name: 'Not finished' })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel).toContainText('1 of 3 completed', uiTimeout)
    await page.screenshot({ path: shot('track-progress-steward') })

    await panel.getByRole('button', { name: 'Everyone' }).click()
    await expect(panel.getByRole('button', { name: 'Everyone' })).toHaveAttribute('aria-pressed', 'true')
  })
})
