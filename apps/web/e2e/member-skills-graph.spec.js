/**
 * Visual verification for the member skills graph on the members page
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

const shoot = async (page, name) => {
  await page.screenshot({ path: path.resolve(screenshotDir, `${name}.png`), fullPage: false })
  console.log(`Screenshot saved: ${name}.png`)
}

// Canvas nodes aren't DOM elements; the generator exposes their screen
// positions on the canvas parent so we can drive real mouse events
const visibleSkillNode = async (page) => {
  return await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="member-skills-graph"] canvas')
    const rect = canvas.getBoundingClientRect()
    const positions = canvas.parentElement.__skillMapTest.nodePositions()
    const margin = 80
    const node = positions.find(p =>
      p.type === 'skill' &&
      p.x > margin && p.x < rect.width - margin &&
      p.y > margin && p.y < rect.height - margin
    )
    return node ? { name: node.name, x: rect.x + node.x, y: rect.y + node.y } : null
  })
}

test('member skills graph renders and drives the directory search', async ({ page }) => {
  test.setTimeout(180000)
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto('/groups/building-hylo/members')
  const graph = page.getByTestId('member-skills-graph')
  await expect(graph).toBeVisible({ timeout: 60000 })
  await expect(graph.locator('canvas')).toBeVisible()

  // Large graphs paint pre-settled; the wait is for fonts, not physics
  await page.waitForTimeout(2000)
  await shoot(page, 'skills-graph-overview')

  // Threshold dropdown: option rows with skill-count pills
  const thresholdButton = graph.getByTestId('skills-threshold-button')
  await thresholdButton.click()
  await page.waitForTimeout(300)
  await shoot(page, 'skills-graph-threshold-dropdown')

  // "1 person" puts every skill on the map, singletons included
  await page.getByText('1 person', { exact: true }).click()
  await page.waitForTimeout(4000)
  await shoot(page, 'skills-graph-threshold-1')

  // Back to a mid threshold for the interaction shots
  await thresholdButton.click()
  await page.getByText('5+ people', { exact: true }).click()
  await page.waitForTimeout(3000)

  // Hovering a skill spotlights its people and lazy-loads their avatars
  const hoverTarget = await visibleSkillNode(page)
  expect(hoverTarget).not.toBeNull()
  await page.mouse.move(hoverTarget.x, hoverTarget.y)
  await page.waitForTimeout(1200)
  await shoot(page, 'skills-graph-hover')
  console.log(`(hovering "${hoverTarget.name}")`)

  // Enlarge to fullscreen
  await graph.getByTestId('skills-enlarge-button').click()
  await page.waitForTimeout(2500)
  await shoot(page, 'skills-graph-fullscreen')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1500)

  // Clicking a skill node fills the search box and filters the directory
  const clickTarget = await visibleSkillNode(page)
  expect(clickTarget).not.toBeNull()
  await page.mouse.click(clickTarget.x, clickTarget.y)
  await expect(page.getByPlaceholder('Search name, skill, location, keyword')).toHaveValue(clickTarget.name)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
  await shoot(page, 'skills-graph-search-filter')
  console.log(`(filtered by "${clickTarget.name}")`)
})
