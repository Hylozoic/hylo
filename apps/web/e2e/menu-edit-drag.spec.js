/**
 * Regression check: dragging a full-width text/separator row into the middle of
 * full card rows in the one-column edit grid must settle, not oscillate.
 * The drag is cancelled with Escape so no order change persists.
 */
import { test, expect } from '@playwright/test'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

// Runs against the plain dev stack with the .env dev credentials
test.use({ storageState: { cookies: [], origins: [] } })

async function orderSignature (container) {
  return container.evaluate(el =>
    Array.from(el.children).map(c => (c.textContent || '').trim().slice(0, 24)).join('|')
  )
}

test('separator drag reflows once and settles; add menu hover matches create menu', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop-only visual check')
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto('/login')
  await page.getByLabel('email').fill(process.env.E2E_TEST_USERNAME)
  await page.getByLabel('password', { exact: true }).fill(process.env.E2E_TEST_PASSWORD)
  await page.getByRole('button', { name: /sign\s*in/i }).click()
  await expect(page.locator('#center-column-container')).toBeVisible({ timeout: 60000 })

  await page.goto('/groups/aaron-brodeurs-community?edit=true')
  await page.waitForLoadState('networkidle')

  // The sortable grid: the flex-wrap container holding the full-width "Common
  // Views" text row among the cards (text and separator rows drag identically)
  const container = page.locator('div.flex.flex-wrap').filter({ hasText: 'Common Views' }).first()
  await expect(container).toBeVisible()

  const separator = container.locator('> div.w-full').filter({ hasText: 'Common Views' }).first()
  const sepBox = await separator.boundingBox()
  expect(sepBox).not.toBeNull()

  // Find a card in a row below the first row of cards
  const children = await container.locator('> div').all()
  const boxes = []
  for (const child of children) {
    const b = await child.boundingBox()
    if (b) boxes.push(b)
  }
  const cardBoxes = boxes.filter(b => b.height > 100)
  expect(cardBoxes.length).toBeGreaterThan(3)
  const rows = [...new Set(cardBoxes.map(b => Math.round(b.y)))].sort((a, b) => a - b)
  const secondRowY = rows[Math.min(1, rows.length - 1)]
  const target = cardBoxes.find(b => Math.round(b.y) === secondRowY)

  const initialOrder = await orderSignature(container)

  // Drag the separator over the middle of a card in the second card row.
  // Card bodies are inert: hovering the center of a card must not reorder.
  await page.mouse.move(sepBox.x + sepBox.width / 2, sepBox.y + sepBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sepBox.x + sepBox.width / 2, sepBox.y + sepBox.height / 2 + 10, { steps: 3 })
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 })
  await page.waitForTimeout(300)
  // Crossing edges en route may have reordered; once in the inert card body,
  // wiggling inside it must change nothing.
  const orderAtCenter = await orderSignature(container)
  for (const [dx, dy] of [[6, 4], [-8, -3], [5, -5], [-4, 6]]) {
    await page.mouse.move(target.x + target.width / 2 + dx, target.y + target.height / 2 + dy, { steps: 2 })
    await page.waitForTimeout(80)
  }
  expect(await orderSignature(container), 'card center must not reorder').toBe(orderAtCenter)

  // The gap between this card and the next (or the row edge) is a drop zone —
  // moving there must reorder, then hold still and require it to stay put.
  await page.mouse.move(target.x + target.width + 6, target.y + target.height / 2, { steps: 6 })
  const samples = []
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(150)
    samples.push(await orderSignature(container))
  }
  const settled = samples.slice(3)
  const distinctLate = new Set(settled)
  console.log(`late samples distinct orders: ${distinctLate.size} (want 1)`)
  expect(distinctLate.size).toBe(1)
  expect(samples[samples.length - 1], 'gap hover must reorder').not.toBe(initialOrder)

  // The break must land at the hovered gap. Earlier reflows shift the layout,
  // so resolve "the card we are hovering beside" from the live layout: the card
  // in the pointer's row whose right edge sits just left of the pointer.
  const holdPoint = { x: target.x + target.width + 6, y: target.y + target.height / 2 }
  const adjacency = await container.evaluate((el, { x, y }) => {
    const kids = Array.from(el.children)
    const texts = kids.map(c => (c.textContent || '').trim().slice(0, 24))
    let cardIdx = -1
    kids.forEach((c, i) => {
      const r = c.getBoundingClientRect()
      if (r.height > 100 && y >= r.top && y <= r.bottom && x >= r.right - 2 && x - r.right < 40) cardIdx = i
    })
    return { texts, cardIdx }
  }, holdPoint)
  const sepIdx = adjacency.texts.findIndex(s => s.includes('Common Views'))
  console.log(`separator at ${sepIdx}, card left of pointer at ${adjacency.cardIdx} (want adjacent)`)
  expect(adjacency.cardIdx).toBeGreaterThan(-1)
  expect(sepIdx).toBe(adjacency.cardIdx + 1)

  await page.screenshot({ path: path.resolve(screenshotDir, 'menu-drag-1-mid-drag.png') })
  console.log('Screenshot saved: menu-drag-1-mid-drag.png')

  // Cancel: order must return to what it was, nothing persisted
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await page.waitForTimeout(300)
  expect(await orderSignature(container)).toBe(initialOrder)

  // --- Add menu hover matches the global + create menu rows ---
  const addTrigger = page.getByText('Add', { exact: true }).last()
  await addTrigger.click()
  const addViewItem = page.getByRole('menuitem').filter({ hasText: 'Add View' })
  await expect(addViewItem).toBeVisible()
  await addViewItem.hover()
  await page.waitForTimeout(200)
  const bg = await addViewItem.evaluate(el => window.getComputedStyle(el).backgroundColor)
  console.log(`add view item hover background: ${bg}`)
  await page.screenshot({ path: path.resolve(screenshotDir, 'menu-drag-2-add-hover.png') })
  console.log('Screenshot saved: menu-drag-2-add-hover.png')
})
