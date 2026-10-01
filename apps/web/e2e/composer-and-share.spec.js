import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Round 2 posting changes, against the seeded `e2e-public-group` (the E2E user
 * is a member) and its seeded post `1`:
 * - a discussion can be posted without a title
 * - Enter sends a chat message on desktop
 * - posts have a visible Share button that copies the link on desktop
 * - the Introduce yourself link opens the composer with the introduction
 *   template (opened by URL: clicking the welcome step's button would clear the
 *   seeded membership's welcome form for later runs)
 * Screenshots land in e2e/screenshots/, named per project.
 */

test.describe.configure({ timeout: 120000 })

const navTimeout = { timeout: 90000 }
const uiTimeout = { timeout: 60000 }

const GROUP_SLUG = 'e2e-public-group'
/** Named per project, so the desktop and phone runs don't overwrite each other */
const shot = name => `e2e/screenshots/${test.info().project.name}-${name}.png`
const SEEDED_POST_ID = '1'

test.describe('Composer and sharing', () => {
  test('a discussion can be posted without a title', async ({ page }) => {
    await page.goto(`/groups/${GROUP_SLUG}/all?create=post&newPostType=discussion`)
    await waitPastRootSessionLoading(page)
    const modal = page.locator('#create-modal-content')
    await expect(modal).toBeVisible(uiTimeout)
    await expect(modal.locator('.PostEditorTitle input')).toHaveAttribute('placeholder', /optional/i, uiTimeout)

    const text = `Untitled discussion from e2e ${Date.now()}`
    await modal.locator('.PostEditorContent .ProseMirror').click()
    await page.keyboard.type(text)
    await page.screenshot({ path: shot('composer-untitled-discussion') })

    await modal.getByTestId('post-editor-submit').click()
    await expect(modal).toBeHidden(navTimeout)
    await expect(page.getByText(text).first()).toBeVisible(uiTimeout)
  })

  test('on Android, the app prompt stays under an open composer', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-chrome', 'the prompt only shows in Android browsers')
    // The saved session has the prompt dismissed; bring it back for this page
    await page.addInitScript(() => window.localStorage.removeItem('hylo:appInstallPrompt:dismissedAt'))
    await page.goto(`/groups/${GROUP_SLUG}/all?create=post&newPostType=discussion`)
    await waitPastRootSessionLoading(page)
    const modal = page.locator('#create-modal-content')
    await expect(modal).toBeVisible(uiTimeout)
    await expect(page.getByTestId('app-install-prompt')).toBeVisible(uiTimeout)

    await modal.locator('.PostEditorContent .ProseMirror').click()
    await page.keyboard.type('Checking the Post button')
    // A trial click fails when anything covers the button
    await modal.getByTestId('post-editor-submit').click({ trial: true })
    await page.screenshot({ path: shot('composer-over-app-prompt') })
  })

  test('Enter sends a chat message on desktop', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'desktop keyboard behaviour')
    await page.goto(`/groups/${GROUP_SLUG}/chat`)
    await waitPastRootSessionLoading(page)
    const editor = page.locator('.ChatEditorContent .ProseMirror')
    await expect(editor).toBeVisible(uiTimeout)

    const message = `Sent with Enter ${Date.now()}`
    await editor.click()
    await page.keyboard.type(message)
    await expect(page.getByTestId('chat-send-hint')).toBeVisible(uiTimeout)
    await page.screenshot({ path: shot('chat-enter-hint') })
    await page.keyboard.press('Enter')

    await expect(page.locator('#chats').getByText(message).first()).toBeVisible(uiTimeout)
    await expect(editor).not.toContainText(message)
  })

  test('the Share button copies a post link', async ({ page, context }) => {
    test.skip(test.info().project.name !== 'chromium', 'clipboard permissions are Chromium only')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto(`/groups/${GROUP_SLUG}/post/${SEEDED_POST_ID}`)
    await waitPastRootSessionLoading(page)

    const share = page.getByTestId('post-share-button').first()
    await expect(share).toBeVisible(uiTimeout)
    await page.screenshot({ path: shot('post-share-button') })
    await share.click()

    await expect(page.getByText('Link copied')).toBeVisible(uiTimeout)
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(new RegExp(`/post/${SEEDED_POST_ID}$`))
  })

  test('Introduce yourself opens the composer with the introduction template', async ({ page }) => {
    await page.goto(`/groups/${GROUP_SLUG}/all?create=post&newPostType=discussion&template=intro&composerEntry=welcome`)
    await waitPastRootSessionLoading(page)
    const modal = page.locator('#create-modal-content')
    await expect(modal).toBeVisible(uiTimeout)
    const body = modal.locator('.PostEditorContent .ProseMirror')
    await expect(body).not.toBeEmpty(uiTimeout)
    await expect(body.locator('p').first()).toBeVisible(uiTimeout)
    await page.screenshot({ path: shot('composer-introduce-yourself') })
  })
})
