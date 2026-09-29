import { test, expect } from '@playwright/test'

/**
 * The index.html boot loading screen holds still under prefers-reduced-motion:
 * the Hylo mark is drawn already assembled and only the progress bar moves.
 *
 * The loader removes itself under navigator.webdriver so other specs never wait
 * on it; this spec hides that flag before the page's own scripts run.
 */
async function showBootLoader (page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.Navigator.prototype, 'webdriver', { get: () => false, configurable: true })
  })
}

async function sampleLoader (page) {
  return page.evaluate(() => {
    const host = document.getElementById('hylo-boot-loader')
    if (!host) return null
    return {
      mark: host.querySelector('svg')?.innerHTML || '',
      progress: host.querySelector('#hylo-boot-progress')?.style.width || ''
    }
  })
}

test.describe('boot loader with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('shows a still mark while the progress bar advances', async ({ page }) => {
    await showBootLoader(page)
    await page.goto('/')
    await expect(page.locator('#hylo-boot-loader svg')).toBeVisible()
    const early = await sampleLoader(page)
    await page.waitForTimeout(900)
    const later = await sampleLoader(page)
    test.skip(!early || !later, 'The app finished loading before the loader could be sampled twice')
    expect(later.mark).toEqual(early.mark)
    expect(parseFloat(later.progress)).toBeGreaterThanOrEqual(parseFloat(early.progress))
  })
})

test.describe('boot loader with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('animates the mark', async ({ page }) => {
    await showBootLoader(page)
    await page.goto('/')
    await expect(page.locator('#hylo-boot-loader svg')).toBeVisible()
    const early = await sampleLoader(page)
    await page.waitForTimeout(900)
    const later = await sampleLoader(page)
    test.skip(!early || !later, 'The app finished loading before the loader could be sampled twice')
    expect(later.mark).not.toEqual(early.mark)
  })
})
