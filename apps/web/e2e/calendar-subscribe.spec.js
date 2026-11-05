import { test, expect, devices } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Subscribe-to-calendar in the events view header (#1669, #1700), and the prompt after a positive
 * RSVP to add that event to a calendar or subscribe to the RSVP calendar feed.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const PUBLIC_GROUP_SLUG = 'e2e-public-group'
const FAKE_GROUP_CALENDAR_URL = 'https://example.com/group/1/calendar-e2e.ics'
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR

async function gql (page, query, variables) {
  return page.evaluate(async ({ query, variables }) => {
    const res = await fetch('/noo/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    })
    const json = await res.json()
    if (json.errors) throw new Error(JSON.stringify(json.errors))
    return json.data
  }, { query, variables })
}

/** Seeded groups have no calendar token, so give the group feed a URL in GraphQL responses */
async function stubGroupCalendarUrl (page) {
  const fillIn = (value) => {
    if (Array.isArray(value)) return value.map(fillIn)
    if (value && typeof value === 'object') {
      const copy = {}
      for (const [key, v] of Object.entries(value)) {
        copy[key] = key === 'eventCalendarUrl' && !v ? FAKE_GROUP_CALENDAR_URL : fillIn(v)
      }
      return copy
    }
    return value
  }
  await page.route('**/noo/graphql', async (route) => {
    if (!(route.request().postData() || '').includes('eventCalendarUrl')) return route.fallback()
    const response = await route.fetch()
    const json = await response.json()
    await route.fulfill({ response, json: fillIn(json) })
  })
}

/** RSVP prompt state lives on the (shared) E2E user's settings: clear it so the prompt can show */
async function resetRsvpCalendarPromptSettings (page) {
  await gql(
    page,
    'mutation ($changes: MeInput) { updateMe(changes: $changes) { id } }',
    { changes: { settings: { hideRsvpCalendarPrompt: false, rsvpCalendarSub: false } } }
  )
}

async function createEvent (page, title = `E2E RSVP calendar prompt (${test.info().project.name})`) {
  const { group } = await gql(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: PUBLIC_GROUP_SLUG })
  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const { createPost } = await gql(
    page,
    'mutation ($data: PostInput) { createPost(data: $data) { id } }',
    {
      data: {
        type: 'event',
        title,
        details: '<p>Bring a snack.</p>',
        groupIds: [group.id],
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        timezone: 'UTC'
      }
    }
  )
  return { postId: createPost.id, start, end }
}

// The prompt opens when the RSVP response lands; give it a moment before asserting it did NOT open
const settle = page => page.waitForTimeout(1000)

async function rsvp (page, label) {
  const responded = page.waitForResponse(res =>
    res.url().includes('/noo/graphql') && (res.request().postData() || '').includes('respondToEvent'))
  const rsvpControl = page.getByTestId('event-rsvp')
  await rsvpControl.getByRole('button').click()
  await rsvpControl.getByTestId('dropdown-button-choices').getByText(label, { exact: true }).click()
  await responded
}

test('subscribe button sits in the group events header and opens the feed URL', async ({ page }) => {
  await stubGroupCalendarUrl(page)
  await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/events`)
  await waitPastRootSessionLoading(page)

  const header = page.locator('header.ViewHeader')
  const button = header.getByTestId('calendar-subscribe-button')
  await expect(button).toBeVisible(uiTimeout)
  await expect(header.locator('h2')).toHaveText('Events')

  // On one line inside the header, with no horizontal overflow at phone width
  const box = await button.boundingBox()
  const viewport = page.viewportSize()
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.height).toBeLessThan(40)
  expect(await header.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)

  // Moved, not duplicated: nothing is left under the calendar
  await expect(page.getByTestId('calendar-subscribe-button')).toHaveCount(1)

  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1669-header-${test.info().project.name}.png` })

  await button.click()
  await expect(page.getByTestId('popup-inner')).toContainText(FAKE_GROUP_CALENDAR_URL, uiTimeout)
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1669-header-modal-${test.info().project.name}.png` })
})

test('subscribe to RSVPs button sits in the /all/events header', async ({ page }) => {
  await page.goto('/all/events')
  await waitPastRootSessionLoading(page)

  const header = page.locator('header.ViewHeader')
  const button = header.getByTestId('calendar-subscribe-button')
  await expect(button).toBeVisible(uiTimeout)
  await expect(button).toHaveAttribute('title', 'Subscribe to all the Hylo events you have RSVPed to')
  expect(await header.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1669-all-events-header-${test.info().project.name}.png` })
})

test.describe('RSVP calendar prompt', () => {
  // The prompt's "Don't ask again" is saved on the shared E2E user, so only one project may run
  // these, and one at a time
  test.describe.configure({ mode: 'serial' })
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'chromium', 'mutates the shared E2E user settings')
  })

  test.afterEach(async ({ page }) => {
    await resetRsvpCalendarPromptSettings(page).catch(() => {})
  })

  test('asks after a positive RSVP until "Don\'t ask again"', async ({ page }) => {
    await page.goto('/')
    await waitPastRootSessionLoading(page)
    await resetRsvpCalendarPromptSettings(page)
    const { postId } = await createEvent(page)

    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/post/${postId}`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByText('Bring a snack.')).toBeVisible(uiTimeout)

    const prompt = page.getByTestId('rsvp-calendar-prompt')

    await rsvp(page, 'Not Going')
    await settle(page)
    await expect(prompt).toHaveCount(0)

    await rsvp(page, 'Going')
    await expect(prompt).toBeVisible(uiTimeout)
    await expect(prompt).toContainText('Add this event to your calendar?')
    if (SCREENSHOT_DIR) {
      await prompt.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)))
      await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1669-rsvp-prompt-${test.info().project.name}.png` })
      // Phone layout screenshot from a separate context; "Not now" leaves the settings unchanged
      const phone = await page.context().browser().newContext({ ...devices['Pixel 5'], storageState: './e2e/.auth/session.json', baseURL: new URL(page.url()).origin })
      const phonePage = await phone.newPage()
      await phonePage.goto(new URL(page.url()).pathname)
      await waitPastRootSessionLoading(phonePage)
      await expect(phonePage.getByText('Bring a snack.')).toBeVisible(uiTimeout)
      await rsvp(phonePage, 'Interested')
      const phonePrompt = phonePage.getByTestId('rsvp-calendar-prompt')
      await expect(phonePrompt).toBeVisible(uiTimeout)
      await phonePrompt.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)))
      await phonePage.screenshot({ path: `${SCREENSHOT_DIR}/issue-1669-rsvp-prompt-mobile.png` })
      await phonePrompt.getByRole('button', { name: 'Not now' }).click()
      await phone.close()
    }

    // "Not now" only closes it this time
    await prompt.getByRole('button', { name: 'Not now' }).click()
    await expect(prompt).toHaveCount(0)
    await rsvp(page, 'Interested')
    await expect(prompt).toBeVisible(uiTimeout)

    const saved = page.waitForResponse(res =>
      res.url().includes('/noo/graphql') && (res.request().postData() || '').includes('"hideRsvpCalendarPrompt":true'))
    await prompt.getByRole('button', { name: 'Don\'t ask again' }).click()
    const savedJson = await (await saved).json()
    expect(savedJson.data.updateMe.settings.hideRsvpCalendarPrompt).toBe(true)
    await expect(prompt).toHaveCount(0)

    // Not asked again in the same session
    await rsvp(page, 'Going')
    await settle(page)
    await expect(prompt).toHaveCount(0)

    // Remembered on the account, so it holds after a reload
    await page.reload()
    await waitPastRootSessionLoading(page)
    await expect(page.getByText('Bring a snack.')).toBeVisible(uiTimeout)
    await rsvp(page, 'Interested')
    await expect(page.getByTestId('event-rsvp')).toContainText('Interested')
    await settle(page)
    await expect(prompt).toHaveCount(0)
  })
  test('adds just the RSVPed event to Google Calendar or as an .ics file', async ({ page }) => {
    // Don't load Google in the test: only check the link the popup opens
    await page.context().route('https://calendar.google.com/**', route => route.fulfill({ body: 'google calendar' }))
    await page.goto('/')
    await waitPastRootSessionLoading(page)
    await resetRsvpCalendarPromptSettings(page)
    const title = 'E2E add one event; to a calendar'
    const { postId, start, end } = await createEvent(page, title)
    const utc = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

    await page.goto(`/groups/${PUBLIC_GROUP_SLUG}/post/${postId}`)
    await waitPastRootSessionLoading(page)
    await expect(page.getByText('Bring a snack.')).toBeVisible(uiTimeout)

    const prompt = page.getByTestId('rsvp-calendar-prompt')
    await rsvp(page, 'Going')
    await expect(prompt).toBeVisible(uiTimeout)
    await expect(prompt.getByTestId('rsvp-calendar-prompt-event-title')).toHaveText(title)
    // The subscription is still offered, as the secondary option
    await expect(prompt.getByRole('button', { name: 'Subscribe' })).toBeVisible()
    await expect(prompt).toContainText('Or keep all your RSVPs in sync')

    // Google Calendar: opens a prefilled "new event" page in a new tab, then closes the prompt
    const popupPromise = page.context().waitForEvent('page')
    await prompt.getByRole('button', { name: 'Add to Google Calendar' }).click()
    const popup = await popupPromise
    await popup.waitForURL(/calendar\.google\.com/)
    const googleUrl = new URL(popup.url())
    expect(googleUrl.searchParams.get('action')).toBe('TEMPLATE')
    expect(googleUrl.searchParams.get('text')).toBe(title)
    expect(googleUrl.searchParams.get('dates')).toBe(`${utc(start)}/${utc(end)}`)
    expect(googleUrl.searchParams.get('details')).toContain('Bring a snack.')
    expect(googleUrl.searchParams.get('details')).toContain(`/post/${postId}`)
    await popup.close()
    await expect(prompt).toHaveCount(0)

    // .ics: downloads the event, then closes the prompt. Adding one event doesn't stop the prompt
    await rsvp(page, 'Interested')
    await expect(prompt).toBeVisible(uiTimeout)
    const downloadPromise = page.waitForEvent('download')
    await prompt.getByRole('button', { name: 'Add to Apple or Outlook' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('e2e-add-one-event-to-a-calendar.ics')
    const fs = await import('node:fs/promises')
    const ics = (await fs.readFile(await download.path(), 'utf8')).replace(/\r\n /g, '')
    expect(ics).toContain(`UID:event-${postId}-hylo.com`)
    expect(ics).toContain('SUMMARY:E2E add one event\\; to a calendar')
    expect(ics).toContain(`DTSTART:${utc(start)}`)
    expect(ics).toContain(`DTEND:${utc(end)}`)
    await expect(prompt).toHaveCount(0)

    // Nothing was saved on the account
    const { me } = await gql(page, '{ me { id settings { hideRsvpCalendarPrompt rsvpCalendarSub } } }')
    expect(me.settings.hideRsvpCalendarPrompt).toBeFalsy()
    expect(me.settings.rsvpCalendarSub).toBeFalsy()

    if (SCREENSHOT_DIR) {
      await rsvp(page, 'Going')
      await expect(prompt).toBeVisible(uiTimeout)
      await prompt.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)))
      await page.screenshot({ path: `${SCREENSHOT_DIR}/issue-1669-rsvp-add-event-${test.info().project.name}.png` })
      const phone = await page.context().browser().newContext({ ...devices['Pixel 5'], storageState: './e2e/.auth/session.json', baseURL: new URL(page.url()).origin })
      const phonePage = await phone.newPage()
      await phonePage.goto(new URL(page.url()).pathname)
      await waitPastRootSessionLoading(phonePage)
      await expect(phonePage.getByText('Bring a snack.')).toBeVisible(uiTimeout)
      await rsvp(phonePage, 'Interested')
      const phonePrompt = phonePage.getByTestId('rsvp-calendar-prompt')
      await expect(phonePrompt).toBeVisible(uiTimeout)
      await phonePrompt.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)))
      // Every action fits on the phone screen
      const viewport = phonePage.viewportSize()
      for (const name of ['Add to Google Calendar', 'Add to Apple or Outlook', 'Subscribe', 'Not now']) {
        const box = await phonePrompt.getByRole('button', { name }).boundingBox()
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
      }
      await phonePage.screenshot({ path: `${SCREENSHOT_DIR}/issue-1669-rsvp-add-event-mobile.png` })
      await phonePrompt.getByRole('button', { name: 'Not now' }).click()
      await phone.close()
    }
  })
})
