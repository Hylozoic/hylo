import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * D33 and D63:
 * - the learner sees "1 of 3 completed" at the top of the actions, and a "Next: <title>"
 *   button on the completed action. This runs on a free track the signed-in e2e user (a
 *   steward of the seeded `e2e-public-group`) creates in that group for each run, with three
 *   actions, then enrolls in and completes one of.
 * - the steward sees each learner's N of M in the track's members view, with the Not finished
 *   filter. A learner's count is recorded by a queued job (Post.checkCompletedTrack), which the
 *   isolated E2E stack doesn't run, so this uses the seeded E2E Progress Track in
 *   `e2e-track-progress-group` (see apps/backend/scripts/seed-e2e-baseline.js): E2E Member A has
 *   done one of its three actions and E2E Member B all three.
 * Screenshots land in e2e/screenshots/, named per project.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const GROUP_SLUG = 'e2e-public-group'
const SEEDED_TRACK_PATH = '/groups/e2e-track-progress-group/spaces/e2e-track-progress-space'
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
  // Creating the space made the e2e user a member without enrolling, and stewards leave
  // the space's creator out of the learners. Leaving and enrolling makes them a learner.
  expectOk(await graphql(page, 'mutation ($trackId: ID) { leaveTrack(trackId: $trackId) { id } }', { trackId: track.id }))
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
    await page.goto(`${SEEDED_TRACK_PATH}/members`)
    await waitPastRootSessionLoading(page)
    const panel = page.getByTestId('track-progress-panel')
    const learner = name => panel.getByRole('listitem').filter({ hasText: name })
    await expect(panel).toBeVisible(uiTimeout)
    await expect(panel.getByRole('button', { name: 'Not finished' })).toHaveAttribute('aria-pressed', 'true')
    await expect(learner('E2E Member A')).toContainText('1 of 3 completed', uiTimeout)
    await expect(learner('E2E Member B')).toHaveCount(0)
    // The steward who set the track up is a member of its space but not a learner
    await expect(learner('E2E User')).toHaveCount(0)
    await page.screenshot({ path: shot('track-progress-steward') })

    await panel.getByRole('button', { name: 'Everyone' }).click()
    await expect(panel.getByRole('button', { name: 'Everyone' })).toHaveAttribute('aria-pressed', 'true')
    await expect(learner('E2E Member B')).toContainText('3 of 3 completed', uiTimeout)
    await expect(learner('E2E Member A')).toContainText('1 of 3 completed')
    await page.screenshot({ path: shot('track-progress-steward-everyone') })
  })
})
