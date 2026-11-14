import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'
import { canSeedHyloPro, grantHyloPro, revokeHyloPro } from './helpers/hyloProGrant.js'

/**
 * The chart block of a designed view, drawn in the designer from a stubbed AI
 * turn (no model runs): bar, line and pie charts fit their column, carry an
 * accessible summary and offer their figures as a table.
 */

test.describe.configure({ timeout: 180000, mode: 'serial' })

const GROUP_SLUG = 'e2e-public-group'
const PRO_NOTE = 'e2e designed chart spec'
const uiTimeout = { timeout: 60000 }

const chartTurn = {
  reply: 'I charted the harvest figures from your message: June 120, July 310, August 455 and September 290 lbs.',
  name: 'Harvest',
  view: {
    version: 1,
    blocks: [
      { type: 'heading', text: 'Our harvest', level: 1 },
      { type: 'chart', kind: 'bar', title: 'Harvest by month (lbs)', source: 'From your message', points: [{ label: 'June', value: 120 }, { label: 'July', value: 310 }, { label: 'August', value: 455 }, { label: 'September', value: 290 }] },
      {
        type: 'columns',
        columns: [
          [{ type: 'chart', kind: 'line', title: 'Members', points: [{ label: '2021', value: 18 }, { label: '2022', value: 31 }, { label: '2023', value: 40 }, { label: '2024', value: 52 }] }],
          [{ type: 'chart', kind: 'pie', title: 'Beds by crop', points: [{ label: 'Beans', value: 6 }, { label: 'Kale', value: 4 }, { label: 'Tomatoes', value: 8 }, { label: 'Herbs', value: 2 }] }]
        ]
      }
    ]
  },
  usage: { model: 'claude-opus-5-5', inputTokens: 6173, outputTokens: 381, estimatedCostUsd: 0.032312, pricePerMillionTokens: { input: 4, output: 20 } }
}

const canvasTurn = {
  ...chartTurn,
  reply: 'I put the figures on a canvas.',
  view: {
    version: 1,
    blocks: [{
      type: 'canvas',
      regions: [
        { title: 'Harvest', tone: 'accent', col: 0, row: 0, blocks: [{ type: 'chart', kind: 'bar', title: 'Harvest by plot (lbs)', points: [{ label: 'North beds', value: 210 }, { label: 'Greenhouse', value: 340 }, { label: 'Orchard row', value: 125 }, { label: 'Children\'s garden', value: 60 }] }] },
        { title: 'Beds', tone: 'plain', col: 1, row: 0, blocks: [chartTurn.view.blocks[2].columns[1][0], chartTurn.view.blocks[2].columns[0][0]] }
      ]
    }]
  }
}

test.describe('designed view charts', () => {
  test.skip(({ isMobile }) => isMobile, 'The designer is a desktop layout for now')
  test.skip(!canSeedHyloPro, 'needs E2E_DATABASE_URL to give the group Hylo Pro')

  test.beforeAll(() => { if (canSeedHyloPro) grantHyloPro(GROUP_SLUG, PRO_NOTE) })
  test.afterAll(() => { if (canSeedHyloPro) revokeHyloPro(PRO_NOTE) })

  test('draws bar, line and pie charts that fit their columns', async ({ page }) => {
    const turns = [chartTurn]
    await page.route('**/noo/graphql', async route => {
      const body = route.request().postData() || ''
      if (!body.includes('DesignGroupViewTurn')) return route.continue()
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { designGroupViewTurn: turns[turns.length - 1] } }) })
    })

    await page.goto(`/groups/${GROUP_SLUG}/design/new`)
    await waitPastRootSessionLoading(page)
    const chat = page.getByTestId('designer-chat-column')
    await expect(chat).toBeVisible(uiTimeout)
    await chat.getByRole('textbox', { name: 'Message' }).fill('Make a bar chart of our harvest by month: June 120 lbs, July 310 lbs, August 455 lbs, September 290 lbs')
    await chat.getByRole('button', { name: 'Send' }).click()

    const canvas = page.getByTestId('designer-canvas')
    await expect(canvas.locator('[data-block="chart"]')).toHaveCount(3, uiTimeout)
    await expect(canvas.getByTestId('designed-chart-bar')).toHaveCount(4)
    await expect(canvas.getByTestId('designed-chart-point')).toHaveCount(4)
    await expect(canvas.getByTestId('designed-chart-slice')).toHaveCount(4)
    await expect(canvas.getByRole('img', { name: 'Bar chart, Harvest by month (lbs): June 120, July 310, August 455, September 290' })).toBeVisible()

    // Every chart is as wide as its column, and no wider
    for (const chart of await canvas.locator('[data-block="chart"]').all()) {
      const frame = await chart.boundingBox()
      const svg = await chart.getByTestId('designed-chart-svg').boundingBox()
      expect(svg.width).toBeLessThanOrEqual(frame.width + 1)
    }
    await page.screenshot({ path: 'e2e-screenshots/designed-chart-1.png' })

    await canvas.getByText('Show the figures').first().click()
    await expect(canvas.getByRole('table').first()).toContainText('August455')
    await page.screenshot({ path: 'e2e-screenshots/designed-chart-2-figures.png' })

    // In a canvas region, about 330px wide, long labels put the bars in rows
    turns.push(canvasTurn)
    await chat.getByRole('textbox', { name: 'Message' }).fill('Put these on a canvas')
    await chat.getByRole('button', { name: 'Send' }).click()
    await expect(canvas.getByTestId('designed-canvas-region')).toHaveCount(2, uiTimeout)
    for (const chart of await canvas.locator('[data-block="chart"]').all()) {
      const frame = await chart.boundingBox()
      const svg = await chart.getByTestId('designed-chart-svg').boundingBox()
      expect(frame.width).toBeLessThan(360)
      expect(svg.width).toBeLessThanOrEqual(frame.width + 1)
    }
    await page.screenshot({ path: 'e2e-screenshots/designed-chart-3-canvas.png' })
  })
})
