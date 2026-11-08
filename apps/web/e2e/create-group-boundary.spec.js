import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

test.describe.configure({ timeout: 300000 })

// Headless Chromium has no GPU here; SwiftShader gives deck.gl a software WebGL context to draw with
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } })

/**
 * Clicks three corners onto the boundary map, then presses Enter to close the shape.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} map
 */
async function drawTriangle (page, map) {
  const box = await map.boundingBox()
  const points = [
    [box.x + box.width * 0.35, box.y + box.height * 0.3],
    [box.x + box.width * 0.7, box.y + box.height * 0.4],
    [box.x + box.width * 0.45, box.y + box.height * 0.75]
  ]
  for (const [x, y] of points) {
    await page.mouse.move(x, y, { steps: 5 })
    await page.mouse.click(x, y)
    await page.waitForTimeout(250)
  }
  await page.keyboard.press('Enter')
}

test.describe('Create Group boundary', () => {
  test.beforeAll(() => {
    fs.mkdirSync(screenshotDir, { recursive: true })
  })

  test('draws a boundary polygon from the Location pill and saves it with the group', async ({ page }) => {
    const slug = `boundary-${Date.now()}`
    await page.goto(`/public/all?create=group&name=${encodeURIComponent('Watershed Boundary')}&slug=${slug}`)
    // First load of a cold dev server re-optimizes deps and reloads the page, so allow it time
    await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 180000 })
    const dialog = page.getByRole('dialog', { name: 'Create a group' })
    await expect(dialog).toBeVisible({ timeout: 30000 })

    await dialog.getByRole('button', { name: 'Location', exact: true }).click()
    const drawButton = dialog.getByTestId('draw-boundary')
    await expect(drawButton).toBeVisible()
    await page.screenshot({ path: path.resolve(screenshotDir, 'create-group-boundary-01-location-pill.png') })

    await drawButton.click()
    const editor = dialog.getByTestId('boundary-editor')
    await expect(editor.getByText('Click the map to add points')).toBeVisible()
    const map = editor.locator('canvas').first()
    await expect(map).toBeVisible({ timeout: 30000 })
    await page.waitForTimeout(1500)

    await drawTriangle(page, map)
    await expect(editor.getByText('Boundary drawn. Use the pen to redraw it.')).toBeVisible()
    await expect(editor.getByRole('button', { name: 'Remove boundary' })).toBeVisible()
    await page.waitForTimeout(1000)
    await editor.scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.resolve(screenshotDir, 'create-group-boundary-02-drawn.png') })

    await dialog.locator('#groupSlug').fill(slug)
    await dialog.getByRole('button', { name: /Create Group/i }).click()
    await expect(page).toHaveURL(new RegExp(`/groups/${slug}`), { timeout: 60000 })

    const geoShape = await page.evaluate(async (groupSlug) => {
      const res = await fetch('/noo/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query ($slug: String) { group(slug: $slug) { geoShape } }', variables: { slug: groupSlug } })
      })
      const json = await res.json()
      return json.data.group.geoShape
    }, slug)
    expect(geoShape.type).toBe('Polygon')
    expect(geoShape.coordinates[0].length).toBeGreaterThanOrEqual(4)
  })
})
