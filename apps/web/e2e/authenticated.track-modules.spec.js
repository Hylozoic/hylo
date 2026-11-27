import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Track outline with modules: the steward's outline editor and the participant view.
 * The default E2E user is an Administrator of `e2e-public-group` (`seed-e2e-baseline.js`).
 * The test makes its own track space there, and creates the space and its actions
 * through GraphQL so it doesn't depend on the space dialog or the post editor.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const GROUP_SLUG = 'e2e-public-group'

/** Creates a published track space in the group and returns the space's slug. */
async function createTrackSpace (page, name) {
  const parent = await graphql(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: GROUP_SLUG })
  const created = await graphql(page, `mutation ($parentGroupId: ID!, $name: String!, $description: String, $viewTypes: [String], $status: GroupStatus) {
    createSpace(parentGroupId: $parentGroupId, name: $name, description: $description, viewTypes: $viewTypes, status: $status, addToMenu: true) {
      id
      slug
    }
  }`, {
    parentGroupId: parent.group.id,
    name,
    description: 'A four-week cohort for people who host meetings where real decisions get made.',
    viewTypes: ['track-actions', 'members'],
    status: 'published'
  })
  await graphql(page, `mutation ($data: TrackInput) {
    createTrack(data: $data) { id }
  }`, { data: { groupId: created.createSpace.id, actionDescriptor: 'Practice', actionDescriptorPlural: 'Practices' } })
  return created.createSpace.slug
}

/** Runs a GraphQL request as the logged-in user and returns `data`. */
async function graphql (page, query, variables) {
  return page.evaluate(async ({ query, variables }) => {
    const res = await fetch('/noo/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    })
    const json = await res.json()
    if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 400))
    return json.data
  }, { query, variables })
}

/** Creates an action post in the track, optionally inside a module. */
async function createAction (page, { spaceId, trackId, viewId, moduleId, title, completionAction = 'button' }) {
  const data = await graphql(page, `mutation ($data: PostInput) {
    createPost(data: $data) { id title }
  }`, {
    data: {
      title,
      type: 'action',
      groupIds: [spaceId],
      trackId,
      viewId,
      moduleId,
      completionAction,
      completionActionSettings: { instructions: 'Do the thing' }
    }
  })
  return data.createPost
}

test.describe('Track outline with modules', () => {
  test.skip(({ isMobile }) => isMobile, 'The outline editor drag test uses a mouse')

  test('steward builds an outline with a module; participant view shows progress', async ({ page }) => {
    const run = Date.now().toString(36)
    const moduleTitle = `Listening first ${run}`
    const insideTitle = `Run a go-round ${run}`
    const looseTitle = `Introduce yourself ${run}`

    await page.goto('/')
    await waitPastRootSessionLoading(page)
    const SPACE_SLUG = await createTrackSpace(page, `Holding Group Decisions ${run}`)
    const localSlug = SPACE_SLUG.startsWith(`${GROUP_SLUG}-`) ? SPACE_SLUG.slice(GROUP_SLUG.length + 1) : SPACE_SLUG

    await page.goto(`/groups/${GROUP_SLUG}/spaces/${localSlug}/track-actions?edit=true`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByTestId('track-naming')).toBeVisible(uiTimeout)

    // Call modules "Week"
    const moduleName = page.getByLabel('Module name', { exact: true })
    await moduleName.fill('Week')
    await moduleName.blur()
    const moduleNamePlural = page.getByLabel('Module name plural')
    await moduleNamePlural.fill('Weeks')
    await moduleNamePlural.blur()
    await expect(page.getByTestId('track-add-module')).toHaveText(/Add Week/)

    // Add a module and name it
    const modulesBefore = await page.getByTestId('track-edit-module').count()
    await page.getByTestId('track-add-module').click()
    await expect(page.getByTestId('track-edit-module')).toHaveCount(modulesBefore + 1, uiTimeout)
    const newModule = page.getByTestId('track-edit-module').last()
    const titleInput = newModule.getByLabel('Week title')
    await expect(titleInput).toHaveValue('Untitled Week')
    await titleInput.fill(moduleTitle)
    await titleInput.blur()
    const descriptionInput = newModule.getByPlaceholder(/What this Week is about/)
    await descriptionInput.fill('Slowing the room down before anything gets decided.')
    await descriptionInput.blur()

    // Add one action inside the module and one at the top level
    const ids = await graphql(page, `query ($slug: String) {
      group(slug: $slug) {
        id
        track { id }
        groupViews { items { id type trackModules { id title } } }
      }
    }`, { slug: SPACE_SLUG })
    const view = ids.group.groupViews.items.find(v => v.type === 'track-actions')
    const createdModule = view.trackModules.find(m => m.title === moduleTitle)
    expect(createdModule, 'the renamed module is saved').toBeTruthy()
    const base = { spaceId: ids.group.id, trackId: ids.group.track.id, viewId: view.id }
    await createAction(page, { ...base, moduleId: createdModule.id, title: insideTitle, completionAction: 'text' })
    await createAction(page, { ...base, title: looseTitle, completionAction: 'comment' })

    await page.reload()
    await waitPastRootSessionLoading(page)
    const editModule = page.getByTestId('track-edit-module').filter({ has: page.locator(`input[value="${moduleTitle}"]`) })
    await expect(editModule).toBeVisible(uiTimeout)
    await expect(editModule.getByTestId('track-edit-action')).toHaveCount(1)
    await expect(editModule.getByText(insideTitle)).toBeVisible()
    const looseRow = page.getByTestId('track-edit-action').filter({ hasText: looseTitle })
    await expect(looseRow).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/track-outline-editor.png', fullPage: true })

    // Drag the top-level action onto the module's header: it joins the module
    const grip = looseRow.getByLabel('Drag to reorder')
    const gripBox = await grip.boundingBox()
    const headerBox = await editModule.getByLabel('Week title').boundingBox()
    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y - 12, { steps: 4 })
    await page.mouse.move(headerBox.x + 40, headerBox.y + headerBox.height / 2, { steps: 12 })
    await page.mouse.up()
    await expect(editModule.getByTestId('track-edit-action')).toHaveCount(2, uiTimeout)
    await expect(editModule.getByText(looseTitle)).toBeVisible()

    // The move is saved, not just shown
    await expect.poll(async () => {
      const data = await graphql(page, `query ($slug: String) {
        group(slug: $slug) { groupViews { items { type trackModules { id postIds } } } }
      }`, { slug: SPACE_SLUG })
      const saved = data.group.groupViews.items.find(v => v.type === 'track-actions').trackModules.find(m => m.id === createdModule.id)
      return saved.postIds.length
    }, uiTimeout).toBe(2)
    await expect(page.getByTestId('track-drag-overlay')).toHaveCount(0)
    await page.screenshot({ path: 'e2e/screenshots/track-outline-editor-after-drag.png', fullPage: true })

    // Participant view
    await page.getByRole('button', { name: 'Done Editing' }).click()
    const summary = page.getByTestId('track-summary')
    await expect(summary).toBeVisible(uiTimeout)
    await expect(summary).toContainText(/of \d+ done/)
    const moduleBlock = page.getByTestId('track-module').filter({ hasText: moduleTitle })
    await expect(moduleBlock).toBeVisible()
    await expect(moduleBlock).toContainText('0/2')
    if (await moduleBlock.getByTestId('track-action-row').count() === 0) {
      await moduleBlock.getByRole('button', { expanded: false }).click()
    }
    await expect(moduleBlock.getByTestId('track-action-row')).toHaveCount(2)
    await expect(moduleBlock.getByText('Slowing the room down')).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/track-outline-participant.png', fullPage: true })

    // Opening an action shows the post
    await moduleBlock.getByTestId('track-action-row').filter({ hasText: insideTitle }).click()
    await expect(page).toHaveURL(/\/post\/\d+/, uiTimeout)
  })
})
