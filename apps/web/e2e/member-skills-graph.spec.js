/**
 * Visual verification for the member skills graph on the members page
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.use({ storageState: 'e2e/.auth/session.json' })

const screenshotDir = path.resolve(import.meta.dirname, 'screenshots')

const shoot = async (page, name) => {
  await page.screenshot({ path: path.resolve(screenshotDir, `${name}.png`), fullPage: false })
  console.log(`Screenshot saved: ${name}.png`)
}

// Canvas nodes aren't DOM elements; the generator exposes their screen
// positions on the canvas parent so we can drive real mouse events.
// Pick the skill closest to center — a small graph on a 300px canvas often
// sits inside an 80px edge margin.
const visibleSkillNode = async (page) => {
  return await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="member-skills-graph"] canvas')
    const hook = canvas?.parentElement?.__skillMapTest
    if (!canvas || !hook) return null
    const rect = canvas.getBoundingClientRect()
    const margin = 16
    const skills = hook.nodePositions().filter(p =>
      p.type === 'skill' &&
      p.x > margin && p.x < rect.width - margin &&
      p.y > margin && p.y < rect.height - margin
    )
    if (!skills.length) return null
    const cx = rect.width / 2
    const cy = rect.height / 2
    skills.sort((a, b) => {
      const da = (a.x - cx) ** 2 + (a.y - cy) ** 2
      const db = (b.x - cx) ** 2 + (b.y - cy) ** 2
      return da - db
    })
    const node = skills[0]
    return { name: node.name, x: rect.x + node.x, y: rect.y + node.y }
  })
}

test('member skills graph renders and drives the directory search', async ({ page }) => {
  test.skip(test.info().project.name.includes('mobile'), 'skills graph geometry is desktop')
  test.setTimeout(180000)
  fs.mkdirSync(screenshotDir, { recursive: true })

  await page.goto('/groups/e2e-public-group/members')
  await waitPastRootSessionLoading(page)
  await page.getByTestId('skill-map-toggle').click()
  const graph = page.getByTestId('member-skills-graph')
  await expect(graph).toBeVisible({ timeout: 60000 })
  await expect(graph.getByText('Loading skills map')).toBeHidden({ timeout: 60000 })
  await expect(graph.getByTestId('skills-enlarge-button')).toBeVisible({ timeout: 30000 })
  await expect(graph.locator('canvas')).toBeVisible()

  await page.waitForTimeout(2000)
  await shoot(page, 'skills-graph-overview')

  const thresholdButton = graph.getByTestId('skills-threshold-button')
  await thresholdButton.click()
  await page.waitForTimeout(300)
  await shoot(page, 'skills-graph-threshold-dropdown')

  await graph.getByRole('list').getByText('1 person', { exact: true }).click()
  await expect(graph.getByText('Loading skills map')).toBeHidden({ timeout: 15000 })
  await expect.poll(() => visibleSkillNode(page), { timeout: 15000 }).not.toBeNull()
  const hoverTarget = await visibleSkillNode(page)
  await shoot(page, 'skills-graph-threshold-1')
  await page.mouse.move(hoverTarget.x, hoverTarget.y)
  await page.waitForTimeout(1200)
  await shoot(page, 'skills-graph-hover')
  console.log(`(hovering "${hoverTarget.name}")`)

  await graph.getByTestId('skills-enlarge-button').click()
  await page.waitForTimeout(2500)
  await shoot(page, 'skills-graph-fullscreen')
  await page.keyboard.press('Escape')
  await expect(graph.getByText('Loading skills map')).toBeHidden({ timeout: 15000 })
  await expect.poll(() => visibleSkillNode(page), { timeout: 15000 }).not.toBeNull()
  const clickTarget = await visibleSkillNode(page)
  await page.mouse.click(clickTarget.x, clickTarget.y)
  await expect(page.getByPlaceholder('Search name, skill, location, keyword')).toHaveValue(clickTarget.name)
  await page.waitForTimeout(600)
  await shoot(page, 'skills-graph-search-filter')
  console.log(`(filtered by "${clickTarget.name}")`)
})
