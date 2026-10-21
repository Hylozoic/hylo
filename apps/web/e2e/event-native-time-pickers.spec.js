/**
 * Event start/end times (issue #1677). Touch devices (mobile-chrome) get the OS date and time
 * pickers instead of the popover calendar, whose typed time inputs didn't work with Android
 * soft keyboards. Desktop keeps the popover.
 *
 * The browser runs in America/Los_Angeles and the post uses Europe/Berlin, so a stored instant
 * that matches what was picked proves the wall-clock -> timezone conversion still happens.
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

const GROUP = 'e2e-public-group'
const screenshotDir = process.env.E2E_SCREENSHOT_DIR || path.resolve(import.meta.dirname, 'screenshots')
const uiTimeout = { timeout: 60000 }

test.use({ storageState: 'e2e/.auth/session.json', timezoneId: 'America/Los_Angeles' })
test.setTimeout(240000)

// Phone projects: Chrome on Android (mobile-chrome) and WebKit on iPhone (mobile-safari)
const PHONE_PROJECTS = ['mobile-chrome', 'mobile-safari']
const isPhoneProject = () => PHONE_PROJECTS.includes(test.info().project.name)

/** Screenshots from the WebKit project are named issue-1677-webkit-*, the rest issue-1677-mobile-* / -desktop-* */
async function screenshot (page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true })
  const file = test.info().project.name === 'mobile-safari' ? name.replace('issue-1677-mobile-', 'issue-1677-webkit-') : name
  await page.screenshot({ path: path.resolve(screenshotDir, file) })
}

/**
 * Unsaved drafts are kept per route, so a test that types into the editor without saving uses
 * its own `basePath` to keep its draft out of the other tests.
 */
async function openEventEditor (page, basePath = `/groups/${GROUP}/all`) {
  await page.goto(`${basePath}?create=post&newPostType=event`)
  await waitPastRootSessionLoading(page)
  const timeframe = page.getByTestId('post-editor-timeframe')
  await expect(timeframe).toBeVisible(uiTimeout)
  return timeframe
}

async function selectPostTimezone (page, search, ianaName) {
  await page.getByTestId('post-editor-timezone').click()
  await page.getByPlaceholder('Search timezones...').fill(search)
  await page.getByRole('option', { name: new RegExp(ianaName) }).first().click()
  await expect(page.getByTestId('post-editor-timezone')).toContainText(ianaName)
}

async function fetchPostTimes (page, postId) {
  return page.evaluate(async (id) => {
    const res = await fetch('/noo/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query: 'query ($id: ID) { post(id: $id) { id startTime endTime timezone } }', variables: { id } })
    })
    const json = await res.json()
    if (json.errors) throw new Error(JSON.stringify(json.errors))
    return json.data.post
  }, postId)
}

/**
 * Horizontal overflow in the create-post modal: the modal's scroll container and wrapper must
 * not scroll sideways, and no visible element of the editor may stick out of the editor card.
 */
async function measureEditorOverflow (page) {
  return page.evaluate(() => {
    const wrapper = document.getElementById('create-modal-content')
    const scroller = wrapper?.parentElement
    const editor = document.querySelector('[data-testid="post-editor"]')
    const editorRect = editor.getBoundingClientRect()
    const describe = el => `${el.tagName.toLowerCase()}${el.dataset.testid ? `[${el.dataset.testid}]` : ''}.${String(el.className || '').slice(0, 50)}`
    const offenders = [...editor.querySelectorAll('*')]
      .filter(el => {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return false
        const style = window.getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none') return false
        return rect.right > editorRect.right + 1 || rect.left < editorRect.left - 1
      })
      .map(el => `${describe(el)} ${Math.round(el.getBoundingClientRect().left)}-${Math.round(el.getBoundingClientRect().right)}`)
    return {
      viewport: window.innerWidth,
      editor: [Math.round(editorRect.left), Math.round(editorRect.right)],
      wrapper: [wrapper.scrollWidth, wrapper.clientWidth],
      scroller: [scroller.scrollWidth, scroller.clientWidth, scroller.scrollLeft],
      offenders: offenders.slice(0, 10)
    }
  })
}

function expectNoEditorOverflow (overflow) {
  expect(overflow.wrapper[0], 'modal wrapper scrolls sideways').toBeLessThanOrEqual(overflow.wrapper[1])
  expect(overflow.scroller[0], 'modal scroll container scrolls sideways').toBeLessThanOrEqual(overflow.scroller[1])
  expect(overflow.scroller[2], 'modal scroll container is shifted sideways').toBe(0)
  expect(overflow.editor[0]).toBeGreaterThanOrEqual(0)
  expect(overflow.editor[1]).toBeLessThanOrEqual(overflow.viewport)
  expect(overflow.offenders, 'elements sticking out of the editor card').toEqual([])
}

test('touch devices pick event times with native inputs; they save in the post timezone', async ({ page }) => {
  test.skip(!isPhoneProject(), 'native pickers are for touch devices; desktop is covered below')

  const timeframe = await openEventEditor(page)
  const pickers = timeframe.getByTestId('native-datetime-picker')
  await expect(pickers).toHaveCount(2)
  const [start, end] = [pickers.nth(0), pickers.nth(1)]
  await expect(start.getByTestId('native-date-input')).toHaveValue('')
  await expect(start.getByTestId('native-date-input')).toHaveAttribute('aria-label', 'Select Start, Date')
  await expect(end.getByTestId('native-time-input')).toHaveAttribute('aria-label', 'Select End, Time')

  // Each picker gets its own full-width row: nothing pokes past the timeframe box
  await timeframe.scrollIntoViewIfNeeded()
  const box = await timeframe.boundingBox()
  for (const input of await timeframe.locator('input').all()) {
    const inputBox = await input.boundingBox()
    expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(box.x + box.width + 1)
  }

  await page.getByTestId('post-editor-title').fill('E2E native time picker event')
  await selectPostTimezone(page, 'Berlin', 'Europe/Berlin')

  // Date first (time defaults to the current hour), then the time; end follows a 1h duration
  await start.getByTestId('native-date-input').fill('2026-11-05')
  await start.getByTestId('native-time-input').fill('14:30')
  await expect(end.getByTestId('native-date-input')).toHaveValue('2026-11-05')
  await expect(end.getByTestId('native-time-input')).toHaveValue('15:30')

  // Changing only the end time keeps its date, and the new duration is kept when start moves
  await end.getByTestId('native-time-input').fill('16:00')
  await start.getByTestId('native-time-input').fill('15:00')
  await expect(end.getByTestId('native-time-input')).toHaveValue('16:30')
  await start.getByTestId('native-time-input').fill('14:30')
  await expect(end.getByTestId('native-time-input')).toHaveValue('16:00')
  await expect(start.getByTestId('native-date-input')).toHaveValue('2026-11-05')

  // Filled values fit their inputs (no clipped dates or times)
  const clipped = await timeframe.locator('input').evaluateAll(els => els.filter(el => el.scrollWidth > el.clientWidth + 1).length)
  expect(clipped).toBe(0)

  // Still fits on a 360px-wide phone
  const viewport = page.viewportSize()
  await page.setViewportSize({ width: 360, height: viewport.height })
  const narrowBox = await timeframe.boundingBox()
  expect(narrowBox.x + narrowBox.width).toBeLessThanOrEqual(360)
  for (const input of await timeframe.locator('input').all()) {
    const inputBox = await input.boundingBox()
    expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(narrowBox.x + narrowBox.width + 1)
    expect(inputBox.width).toBeGreaterThan(120)
  }
  await page.setViewportSize(viewport)
  await timeframe.scrollIntoViewIfNeeded()
  await screenshot(page, 'issue-1677-mobile-native-light.png')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(300)
  await screenshot(page, 'issue-1677-mobile-native-dark.png')
  await page.emulateMedia({ colorScheme: 'light' })

  const created = page.waitForResponse(res => res.url().includes('/noo/graphql') &&
    (res.request().postData() || '').includes('createPost'))
  const submit = page.getByTestId('post-editor-submit')
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeEnabled()
  await submit.click()
  const postId = (await (await created).json()).data.createPost.id
  expect(postId).toBeTruthy()

  // 14:30-16:00 in Berlin (CET, UTC+1 on 2026-11-05)
  const post = await fetchPostTimes(page, postId)
  expect(post.timezone).toBe('Europe/Berlin')
  expect(new Date(post.startTime).toISOString()).toBe('2026-11-05T13:30:00.000Z')
  expect(new Date(post.endTime).toISOString()).toBe('2026-11-05T15:00:00.000Z')

  // Editing the saved event shows the same Berlin wall-clock times
  await page.goto(`/groups/${GROUP}/post/${postId}/edit`)
  await waitPastRootSessionLoading(page)
  const editPickers = page.getByTestId('post-editor-timeframe').getByTestId('native-datetime-picker')
  await expect(editPickers.nth(0).getByTestId('native-date-input')).toHaveValue('2026-11-05', uiTimeout)
  await expect(editPickers.nth(0).getByTestId('native-time-input')).toHaveValue('14:30')
  await expect(editPickers.nth(1).getByTestId('native-time-input')).toHaveValue('16:00')
})

test('desktop keeps the popover date/time picker', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromium', 'desktop pointer only')

  const timeframe = await openEventEditor(page)
  await expect(timeframe.getByTestId('native-datetime-picker')).toHaveCount(0)
  // The start trigger's name changes once a value is picked, so hold on to it by position
  const startButton = timeframe.getByRole('button').first()
  await expect(startButton).toHaveText(/Select Start/)
  await startButton.click()
  const hour = page.locator('#datetime-picker-hour-input')
  await expect(hour).toBeVisible()
  await expect(hour).toHaveAttribute('enterkeyhint', 'done')

  // Keyboard behaviour is unchanged: arrows step the hour, and the end time follows
  await hour.focus()
  await page.keyboard.press('ArrowUp')
  const startLabel = await startButton.textContent()
  expect(startLabel).not.toContain('Select Start')
  await expect(timeframe.getByRole('button', { name: /Select End/ })).toHaveCount(0)
  await page.waitForTimeout(500)
  await screenshot(page, 'issue-1677-desktop-popover.png')

  // Enter closes the popover
  await page.keyboard.press('Enter')
  await expect(hour).toBeHidden()
})

test('funding round dates use native inputs on touch devices', async ({ page }) => {
  test.skip(!isPhoneProject(), 'touch-device layout check')

  await page.goto(`/groups/${GROUP}/more-spaces?edit=true`)
  await waitPastRootSessionLoading(page)
  const addButton = page.locator('#center-column-container').getByRole('button', { name: 'Add to More Spaces' })
  await expect(addButton).toBeVisible(uiTimeout)
  await addButton.click()
  await page.locator('[data-tour="space-type-funding-round"]').click()
  const schedule = page.locator('[data-tour="round-schedule"]')
  await expect(schedule).toBeVisible(uiTimeout)
  const pickers = schedule.getByTestId('native-datetime-picker')
  await expect(pickers).toHaveCount(4)
  await expect(pickers.first().getByTestId('native-time-input')).toHaveAttribute('step', '60')
  await expect(pickers.first().getByTestId('native-date-input')).toHaveAttribute('aria-label', 'Submissions open, Date')

  await pickers.first().getByTestId('native-date-input').fill('2026-12-01')
  await pickers.first().getByTestId('native-time-input').fill('09:00')
  await expect(pickers.first().getByTestId('native-time-input')).toHaveValue('09:00')

  const box = await schedule.boundingBox()
  for (const input of await schedule.locator('input').all()) {
    const inputBox = await input.boundingBox()
    expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(box.x + box.width + 1)
  }
  await schedule.scrollIntoViewIfNeeded()
  await screenshot(page, 'issue-1677-mobile-funding-round.png')

  // Still inside the dialog on a 320px phone
  await page.setViewportSize({ width: 320, height: page.viewportSize().height })
  await page.waitForTimeout(250)
  const narrowBox = await schedule.boundingBox()
  expect(narrowBox.x + narrowBox.width).toBeLessThanOrEqual(320)
  for (const input of await schedule.locator('input').all()) {
    const inputBox = await input.boundingBox()
    expect(inputBox.x).toBeGreaterThanOrEqual(narrowBox.x - 1)
    expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(narrowBox.x + narrowBox.width + 1)
  }
  await schedule.scrollIntoViewIfNeeded()
  await screenshot(page, 'issue-1677-mobile-funding-round-320.png')
})

test('the post editor fits phones from 320 to 430px with native inputs and a long timezone', async ({ page }) => {
  test.skip(!isPhoneProject(), 'phone layout check')

  const timeframe = await openEventEditor(page, '/all/all')
  await page.getByTestId('post-editor-title').fill('E2E long timezone layout check')
  // The longest common label: "(+11:00) Australian Eastern Time — Australia/Sydney"
  await selectPostTimezone(page, 'Sydney', 'Australia/Sydney')
  const pickers = timeframe.getByTestId('native-datetime-picker')
  await pickers.nth(0).getByTestId('native-date-input').fill('2026-12-24')
  await pickers.nth(0).getByTestId('native-time-input').fill('12:00')

  // CSS that keeps iOS's intrinsically sized date/time inputs inside their box (emulated
  // Chrome doesn't size them like iOS, so check the styles themselves too)
  const inputStyles = await timeframe.locator('input').evaluateAll(els => els.map(el => {
    const style = window.getComputedStyle(el)
    return [style.appearance, style.minWidth, style.maxWidth, style.boxSizing, style.display].join(' ')
  }))
  for (const style of inputStyles) expect(style).toBe('none 0px 100% border-box block')

  const height = page.viewportSize().height
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(250)
    // Focusing an input is what made the modal jump sideways on iOS
    await pickers.nth(1).getByTestId('native-time-input').focus()
    await page.waitForTimeout(150)
    const overflow = await measureEditorOverflow(page)
    console.log(`[1677] overflow at ${width}px:`, JSON.stringify(overflow))
    expectNoEditorOverflow(overflow)

    // Every Timeframe and Timezone element stays inside its card
    for (const card of [timeframe, page.getByTestId('post-editor-timezone').locator('..')]) {
      const cardBox = await card.boundingBox()
      for (const el of await card.locator('input, button, span, svg').all()) {
        const box = await el.boundingBox()
        if (!box || box.width === 0) continue
        expect(box.x).toBeGreaterThanOrEqual(cardBox.x - 1)
        expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1)
      }
    }
    if (width !== 430) {
      await timeframe.scrollIntoViewIfNeeded()
      await screenshot(page, `issue-1677-mobile-${width}.png`)
    }
  }

  // The layout mustn't depend on how an engine sizes the controls themselves. Make the
  // timezone trigger and the date/time cells size by their own width (flex: none), as a
  // stand-in for iOS sizing them differently: a flex row of "label + w-full control" then
  // overflows by the label's width, while grid tracks of minmax(0, 1fr) still hold.
  await page.addStyleTag({ content: '[data-testid="post-editor-timezone"], [data-testid="native-datetime-picker"] > div { flex: none !important; }' })
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(250)
    const overflow = await measureEditorOverflow(page)
    console.log(`[1677] overflow at ${width}px with intrinsic-size stress:`, JSON.stringify(overflow))
    expectNoEditorOverflow(overflow)
  }

  await page.setViewportSize({ width: 375, height })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(300)
  expectNoEditorOverflow(await measureEditorOverflow(page))
  await timeframe.scrollIntoViewIfNeeded()
  await screenshot(page, 'issue-1677-mobile-375-dark.png')
  await page.emulateMedia({ colorScheme: 'light' })
})
