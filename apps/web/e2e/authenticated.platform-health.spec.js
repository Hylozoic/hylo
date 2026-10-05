import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Management → Platform health (`/management/platform/health`).
 *
 * The rendering test serves a fixture so it doesn't depend on seeded activity. The committed fixture is
 * synthetic: invented numbers passed through the metrics' own transforms. Take screenshots for pull
 * requests, issues or anything else shared only from it. PLATFORM_HEALTH_FIXTURE can point at another
 * JSON file (e.g. a `scripts/platform-health.js --out` result) for local inspection; never screenshot
 * or share a result computed from real data. PLATFORM_HEALTH_SCREENSHOT is a path to save a full-page
 * capture (or, with PLATFORM_HEALTH_SECTION set to a section id, a capture of just that section).
 *
 * The comparison test serves PLATFORM_HEALTH_COMPARE_FIXTURE for the earlier date, or the main fixture
 * moved back a period with every number scaled by 0.8. PLATFORM_HEALTH_COMPARE_PERIOD=6m makes it pick
 * "6 months earlier" instead of the default year. With PLATFORM_HEALTH_COMPARE_SCREENSHOTS set to a
 * directory it saves top.png (header through the vital signs), <sectionId>.png for each id in
 * PLATFORM_HEALTH_COMPARE_SECTIONS, and header-<width>.png for each width in
 * PLATFORM_HEALTH_COMPARE_HEADER_WIDTHS (both comma-separated).
 */

test.describe.configure({ timeout: 120000 })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturePath = process.env.PLATFORM_HEALTH_FIXTURE || path.join(__dirname, 'fixtures', 'platform-health.synthetic.json')
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
const uiTimeout = { timeout: 60000 }
const DAY_MS = 24 * 60 * 60 * 1000
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function daysBefore (day, days) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10)
}

const PERIODS = {
  '1y': { days: 364, months: 12, label: '1 year earlier' },
  '6m': { days: 182, months: 6, label: '6 months earlier' }
}

function monthsBefore (day, months) {
  const [y, m, d] = day.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m - months, 0)).getUTCDate()
  return new Date(Date.UTC(y, m - 1 - months, Math.min(d, lastDay))).toISOString().slice(0, 10)
}

function shiftBack (label, granularity, period) {
  if (typeof label !== 'string' || !ISO_DAY.test(label)) return label
  return granularity === 'month' ? monthsBefore(label, period.months) : daysBefore(label, period.days)
}

function scaled (value) {
  if (typeof value !== 'number') return value
  return Number.isInteger(value) ? Math.round(value * 0.8) : value * 0.8
}

// The main fixture as it might have looked a period earlier: dates moved back, every number scaled
function deriveComparison (panel, period) {
  const earlier = JSON.parse(JSON.stringify(panel))
  earlier.asOf = `${daysBefore(String(panel.asOf).slice(0, 10), period.days)}T00:00:00.000Z`
  for (const metric of earlier.sections.flatMap(section => section.metrics)) {
    const data = metric.data
    // A headline over a trailing window ends on a weekday that moves back whole weeks, like the server's
    const granularity = metric.display === 'series' ? data?.granularity : (metric.headline?.windowDays ? 'day' : 'month')
    if (metric.headline) {
      metric.headline = { ...metric.headline, value: scaled(metric.headline.value), previous: scaled(metric.headline.previous), period: shiftBack(metric.headline.period, granularity, period) }
    }
    if (!data) continue
    if (metric.display === 'series') {
      data.x = data.x.map(x => shiftBack(x, granularity, period))
      data.lines.forEach(line => { line.values = line.values.map(scaled) })
    }
    if (metric.display === 'kpi') {
      for (const key of ['value', 'previous', 'numerator', 'denominator']) data[key] = scaled(data[key])
      ;(data.breakdown || []).forEach(item => { item.value = scaled(item.value) })
    }
    ;(data.steps || []).concat(data.buckets || []).forEach(item => { item.value = scaled(item.value) })
  }
  return earlier
}

const listEnv = name => (process.env[name] || '').split(',').map(item => item.trim()).filter(Boolean)

test.describe('Management: platform health', () => {
  test('renders the north star, vital signs, sections and per-metric errors', async ({ page }) => {
    const requests = []
    await page.route('**/noo/admin/platform-health**', route => {
      requests.push(route.request())
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) })
    })

    await page.goto('/management/platform/health')
    await waitPastRootSessionLoading(page)

    await expect(page.getByRole('heading', { name: 'Platform health' })).toBeVisible(uiTimeout)
    await expect(page.getByTestId('north-star')).toContainText(fixture.northStar.name)
    for (const section of fixture.sections) {
      await expect(page.getByTestId(`section-${section.id}`)).toBeVisible()
    }

    const vitals = fixture.sections.flatMap(s => s.metrics).filter(m => m.vital && m.id !== fixture.northStar.metricId)
    for (const metric of vitals) {
      await expect(page.getByTestId(`vital-tile-${metric.id}`)).toBeVisible()
    }
    await expect(page.getByTestId(`vital-tile-${fixture.northStar.metricId}`)).toHaveCount(0)

    const failed = fixture.sections.flatMap(s => s.metrics).find(m => m.error)
    if (failed) {
      await expect(page.getByTestId(`metric-card-${failed.id}`).getByTestId('metric-error')).toContainText(failed.error)
    }

    expect(requests[0].headers()['x-requested-with']).toBe('hylo-admin')

    if (process.env.PLATFORM_HEALTH_SCREENSHOT) {
      // The app scrolls inside a container, not the window, so grow the viewport to the content.
      const contentHeight = await page.evaluate(() => Math.max(...Array.from(document.querySelectorAll('*'), el => el.scrollHeight)))
      await page.setViewportSize({ width: 1280, height: Math.min(contentHeight + 100, 16000) })
      await expect(page.getByTestId('north-star')).toBeVisible()
      if (process.env.PLATFORM_HEALTH_SECTION) {
        await page.getByTestId(`section-${process.env.PLATFORM_HEALTH_SECTION}`).screenshot({ path: process.env.PLATFORM_HEALTH_SCREENSHOT })
      } else {
        await page.screenshot({ path: process.env.PLATFORM_HEALTH_SCREENSHOT, fullPage: true })
      }
    }
  })

  test('applies a past date only when submitted', async ({ page }) => {
    const urls = []
    await page.route('**/noo/admin/platform-health**', route => {
      urls.push(new URL(route.request().url()).searchParams.get('asOf'))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) })
    })

    await page.goto('/management/platform/health')
    await waitPastRootSessionLoading(page)
    await expect(page.getByTestId('north-star')).toBeVisible(uiTimeout)

    const form = page.getByTestId('as-of-form')
    await form.locator('input[type="date"]').fill('2026-03-20')
    expect(urls).toEqual([null])

    await form.getByRole('button', { name: 'View date' }).click()
    await expect.poll(() => urls).toEqual([null, '2026-03-20'])
  })

  test('compares with the same date a period earlier while the toggle is on', async ({ page }) => {
    const periodKey = process.env.PLATFORM_HEALTH_COMPARE_PERIOD === '6m' ? '6m' : '1y'
    const period = PERIODS[periodKey]
    const comparisonFixture = process.env.PLATFORM_HEALTH_COMPARE_FIXTURE
      ? JSON.parse(fs.readFileSync(process.env.PLATFORM_HEALTH_COMPARE_FIXTURE, 'utf8'))
      : deriveComparison(fixture, period)
    // The comparison is for the date of the numbers shown: the fixture's, not the test machine's clock
    const shownDay = String(fixture.asOf).slice(0, 10)
    const expected = periodKey === '6m'
      ? [null, daysBefore(shownDay, PERIODS['1y'].days), daysBefore(shownDay, period.days)]
      : [null, daysBefore(shownDay, period.days)]

    const requested = []
    await page.route('**/noo/admin/platform-health**', route => {
      const asOf = new URL(route.request().url()).searchParams.get('asOf')
      requested.push(asOf)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(asOf ? comparisonFixture : fixture) })
    })

    await page.goto('/management/platform/health')
    await waitPastRootSessionLoading(page)
    await expect(page.getByTestId('north-star')).toBeVisible(uiTimeout)

    const toggle = page.getByTestId('compare-toggle')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByTestId('comparison-line')).toHaveCount(0)
    expect(requested).toEqual([null])

    await toggle.click()
    await expect.poll(() => requested).toEqual(expected.slice(0, 2))
    await expect(page.getByTestId('comparison-status')).toContainText('Compared with')
    await expect(page.getByTestId('compare-period')).toHaveValue('1y')
    if (periodKey === '6m') {
      await page.getByTestId('compare-period').selectOption('6m')
      await expect.poll(() => requested).toEqual(expected)
    }
    await expect(page.getByTestId('comparison-status')).toContainText(`(${period.days / 7} weeks earlier)`)
    await expect(page.getByTestId('north-star').getByTestId('comparison-headline')).toContainText(`vs ${period.label}`)
    await expect(page.getByTestId('north-star').getByTestId('comparison-line')).toBeVisible()
    expect(await page.getByTestId('comparison-line').count()).toBeGreaterThan(1)

    const shotDir = process.env.PLATFORM_HEALTH_COMPARE_SCREENSHOTS
    if (shotDir) {
      fs.mkdirSync(shotDir, { recursive: true })
      // The app scrolls inside a container, not the window, so grow the viewport to the content.
      const width = page.viewportSize().width
      const contentHeight = await page.evaluate(() => Math.max(...Array.from(document.querySelectorAll('*'), el => el.scrollHeight)))
      await page.setViewportSize({ width, height: Math.min(contentHeight + 100, 16000) })
      await expect(page.getByTestId('north-star')).toBeVisible()
      const panel = await page.getByRole('heading', { name: 'Platform health' }).locator('xpath=ancestor::header/..').boundingBox()
      const vitals = page.locator('section[aria-labelledby="platform-health-vitals"]')
      const last = await ((await vitals.count()) > 0 ? vitals : page.getByTestId('north-star')).boundingBox()
      await page.screenshot({
        path: path.join(shotDir, 'top.png'),
        clip: { x: panel.x, y: panel.y, width: panel.width, height: last.y + last.height + 16 - panel.y }
      })
      for (const id of listEnv('PLATFORM_HEALTH_COMPARE_SECTIONS')) {
        await page.getByTestId(`section-${id}`).screenshot({ path: path.join(shotDir, `${id}.png`) })
      }
      const header = page.locator('header').filter({ has: page.getByRole('heading', { name: 'Platform health' }) })
      for (const headerWidth of listEnv('PLATFORM_HEALTH_COMPARE_HEADER_WIDTHS').map(Number).filter(Boolean)) {
        await page.setViewportSize({ width: headerWidth, height: 900 })
        await header.screenshot({ path: path.join(shotDir, `header-${headerWidth}.png`) })
      }
    }

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByTestId('comparison-status')).toHaveCount(0)
    await expect(page.getByTestId('comparison-line')).toHaveCount(0)
    await expect(page.getByTestId('comparison-headline')).toHaveCount(0)
    expect(requested).toEqual(expected)
  })

  test('the live endpoint refuses accounts that are not platform admins', async ({ page }) => {
    // Bounded by the test timeout rather than its own, since page load under a busy dev server counts too
    const response = page.waitForResponse(res => res.url().includes('/noo/admin/platform-health'), { timeout: 0 })
    await page.goto('/management/platform/health')
    await waitPastRootSessionLoading(page)
    expect((await response).status()).toBe(403)
    await expect(page.getByTestId('panel-error')).toBeVisible(uiTimeout)
    await expect(page.getByTestId('north-star')).toHaveCount(0)
  })
})
