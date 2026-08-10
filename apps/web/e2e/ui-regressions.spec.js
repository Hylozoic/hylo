import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/session.json' })

test('explorer titles are white in light mode', async ({ page }) => {
  await page.goto('/public/groups')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(6000)
  const color = await page.evaluate(() => {
    const h3 = document.querySelector('h3.text-white')
    return h3 ? window.getComputedStyle(h3).color : null
  })
  console.log('title color:', color)
  expect(color).toBe('rgb(255, 255, 255)')
  await page.screenshot({ path: 'e2e/screenshots/explorer-titles.png' })
})

test('stream controls use border-2', async ({ page }) => {
  await page.goto('/groups/building-hylo/stream')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(6000)
  const width = await page.evaluate(() => {
    const pill = [...document.querySelectorAll('button, div')].find(el =>
      el.className && String(el.className).includes('rounded-[9px]'))
    return pill ? window.getComputedStyle(pill).borderTopWidth : null
  })
  console.log('control border width:', width)
  expect(width).toBe('2px')
})

test('directly loaded space closes to group home', async ({ page }) => {
  await page.goto('/groups/building-hylo')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(6000)
  const href = await page.evaluate(() => {
    const link = [...document.querySelectorAll('a')].find(a =>
      a.textContent.includes('Test Space') && a.href.includes('/spaces/'))
    return link ? link.getAttribute('href') : null
  })
  console.log('space href:', href)
  expect(href).not.toBeNull()

  // Direct-load the space-menu takeover (more-views ?space= shows the
  // SpaceMenuHeader with its X) with no in-app history to return to
  await page.goto('/groups/building-hylo/more-views?space=test-space')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'e2e/screenshots/space-direct.png' })
  await page.locator('.SpaceMenuHeader [title="Close"]').click()
  await page.waitForTimeout(1500)
  const url = page.url()
  console.log('after close:', url)
  expect(url.includes('space=')).toBe(false)
})
