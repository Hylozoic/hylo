import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/session.json' })

test('long group names show fully with pills intact', async ({ page }) => {
  await page.goto('/groups/building-hylo')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(3000)
  const target = await page.evaluate(async () => {
    const res = await window.fetch('/noo/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query: 'query { me { memberships { group { slug name } } } }' })
    })
    const json = await res.json()
    const groups = (json?.data?.me?.memberships || []).map(m => m.group)
    groups.sort((a, b) => b.name.length - a.name.length)
    return groups[0]
  })
  console.log('longest-name group:', JSON.stringify(target))

  await page.goto(`/groups/${target.slug}`)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(4000)

  const geom = await page.evaluate(() => {
    const h1 = document.querySelector('.GroupMenuHeaderName')
    const header = document.querySelector('.GroupMenuHeader')
    const pill = header?.querySelector('a[href*="/members"]')
    const style = window.getComputedStyle(h1)
    return {
      text: h1.textContent,
      clamp: style.webkitLineClamp,
      truncated: h1.scrollHeight > h1.clientHeight + 8,
      lines: Math.round(h1.clientHeight / parseFloat(style.lineHeight)),
      pillVisible: Boolean(pill && pill.getBoundingClientRect().height > 0),
      pillBottom: pill ? pill.getBoundingClientRect().bottom : null,
      headerBottom: header.getBoundingClientRect().bottom
    }
  })
  console.log(JSON.stringify(geom))
  expect(geom.clamp === 'none' || geom.clamp === '').toBe(true)
  expect(geom.truncated).toBe(false)
  expect(geom.pillVisible).toBe(true)
  expect(geom.pillBottom).toBeLessThanOrEqual(geom.headerBottom)
  await page.locator('.GroupMenuHeader').screenshot({ path: 'e2e/screenshots/header-name.png' })
})
