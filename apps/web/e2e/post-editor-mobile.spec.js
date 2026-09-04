/**
 * Mobile post-creation modal: the editor gets nearly the phone's full width
 * (8px gutters), and the To-field chip truncates instead of running under the
 * modal edge — its remove control stays visible and the search input wraps to
 * its own line when the chip needs the room.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')
const GROUP = 'e2e-public-group'
const SPACE = 'e2e-test-space'

test.use({ storageState: 'e2e/.auth/session.json', viewport: { width: 375, height: 812 } })
test.setTimeout(240000)

test('post modal fills a phone and the To chip truncates instead of clipping', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'visual check')
  fs.mkdirSync(screenshotDir, { recursive: true })

  // Straight to the create-post modal in a space context: the To field
  // pre-fills with the "Group / Space" chip.
  await page.goto(`/groups/${GROUP}/spaces/${SPACE}/create/post`)
  await waitPastRootSessionLoading(page)
  const toField = page.locator('.PostEditorTo')
  await expect(toField).toBeVisible({ timeout: 60000 })
  await page.waitForTimeout(600)

  const viewport = page.viewportSize()
  const editor = page.locator('.PostEditorTo').locator('..')
  const editorBox = await editor.boundingBox()
  console.log('EDITOR BOX:', JSON.stringify(editorBox), 'VIEWPORT:', JSON.stringify(viewport))

  // 1) Modal spans nearly the full phone width (wrapper gutter is 8px/side)
  expect(editorBox.width).toBeGreaterThan(viewport.width - 40)

  // 2) The chip stays inside the To field: nothing pokes past the right edge,
  //    and the remove control is visible and inside the viewport
  const chip = toField.locator('li').first()
  const chipBox = await chip.boundingBox()
  const toBox = await toField.boundingBox()
  console.log('CHIP:', JSON.stringify(chipBox), 'TOFIELD:', JSON.stringify(toBox))
  expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(toBox.x + toBox.width + 1)
  const remove = chip.locator('a').last()
  await expect(remove).toBeVisible()
  const removeBox = await remove.boundingBox()
  expect(removeBox.x + removeBox.width).toBeLessThanOrEqual(viewport.width)

  await page.screenshot({ path: path.resolve(screenshotDir, 'post-editor-mobile-375.png') })

  // 3) At extreme narrowness the names ellipsize rather than overflow
  await page.setViewportSize({ width: 300, height: 812 })
  await page.waitForTimeout(400)
  const chipBoxNarrow = await chip.boundingBox()
  const toBoxNarrow = await toField.boundingBox()
  expect(chipBoxNarrow.x + chipBoxNarrow.width).toBeLessThanOrEqual(toBoxNarrow.x + toBoxNarrow.width + 1)
  await expect(remove).toBeVisible()
  await page.screenshot({ path: path.resolve(screenshotDir, 'post-editor-mobile-300.png') })
})
