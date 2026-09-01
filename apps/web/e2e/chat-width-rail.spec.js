import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.use({ storageState: 'e2e/.auth/session.json' })

test.describe.configure({ timeout: 120000 })

test('chat width rail sits wholly right of the stream edge', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop chat pane geometry')
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/groups/e2e-public-group/chat')
  await waitPastRootSessionLoading(page)
  await expect(page.locator('#chats')).toBeVisible({ timeout: 60000 })

  const rail = page.locator('[aria-label="Adjust chat width"]')
  await expect(rail).toBeVisible({ timeout: 30000 })

  const geom = await page.evaluate(() => {
    const pane = document.getElementById('chats')
    const rail = document.querySelector('[aria-label="Adjust chat width"]')
    const paneRect = pane.getBoundingClientRect()
    const railRect = rail.getBoundingClientRect()
    const streamWidth = parseFloat(window.getComputedStyle(pane).getPropertyValue('--chat-stream-width'))
    return {
      railLeftInPane: railRect.left - paneRect.left,
      railWidth: railRect.width,
      streamWidth,
      paneWidth: paneRect.width,
      railRight: railRect.right - paneRect.left
    }
  })
  console.log(JSON.stringify(geom))
  // Rail's left (background) edge = pane px-1 (4) + gutter (20) + stream width
  expect(Math.abs(geom.railLeftInPane - (24 + geom.streamWidth))).toBeLessThan(1.5)
  expect(geom.railRight).toBeLessThanOrEqual(geom.paneWidth + 1)

  // Drag left 150px and confirm the rail tracks its background-edge anchor
  const box = await rail.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + 300)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 150, box.y + 300, { steps: 10 })
  await page.screenshot({ path: 'e2e/screenshots/chat-rail-drag.png' })
  await page.mouse.up()
  const after = await page.evaluate(() => {
    const pane = document.getElementById('chats')
    const rail = document.querySelector('[aria-label="Adjust chat width"]')
    const streamWidth = parseFloat(window.getComputedStyle(pane).getPropertyValue('--chat-stream-width'))
    return { railLeftInPane: rail.getBoundingClientRect().left - pane.getBoundingClientRect().left, streamWidth }
  })
  console.log(JSON.stringify(after))
  expect(Math.abs(after.railLeftInPane - (24 + after.streamWidth))).toBeLessThan(1.5)
})
