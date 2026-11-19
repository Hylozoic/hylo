/**
 * Screenshots of the attachment size limit in the post editor (#1761): a group with the Hylo Pro
 * largerUploads feature gets a 1 GB limit, other groups keep 50 MB.
 *
 * Titled "capture screenshot" so the default e2e run skips it: the spec grants Pro to the seeded
 * private group with psql, so it needs E2E_DATABASE_URL, e.g.
 *   E2E_DATABASE_URL=... E2E_SCREENSHOT_DIR=e2e/screenshots yarn node scripts/run-isolated-e2e.js upload-limit --project=chromium
 * Files are never uploaded: the dropped files only have a (faked) size, so the drop zone rejects
 * them and names the limit that applies.
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'child_process'
import fs from 'fs'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR
const PRO_GROUP = 'e2e-private-group'
const FREE_GROUP = 'e2e-public-group'
const NOTE = 'e2e #1761 larger uploads'

function sql (query) {
  return execFileSync('psql', [process.env.E2E_DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-tAc', query], { encoding: 'utf8' }).trim()
}

/** Drops a file of the given (pretend) size onto the editor; the bytes are never read */
async function dropFileOfSize (target, { name, type, size }) {
  await target.evaluate((el, { name, type, size }) => {
    const file = new window.File(['x'], name, { type })
    Object.defineProperty(file, 'size', { value: size })
    const dataTransfer = new window.DataTransfer()
    dataTransfer.items.add(file)
    el.dispatchEvent(new window.DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }))
  }, { name, type, size })
}

async function openPostEditor (page, slug) {
  await page.goto(`/groups/${slug}/all?create=post&newPostType=discussion`)
  await waitPastRootSessionLoading(page)
  const modal = page.locator('#create-modal-content')
  const description = modal.locator('.ProseMirror')
  await expect(description).toBeVisible(uiTimeout)
  return { modal, description }
}

async function screenshot (locator, name) {
  if (!SCREENSHOT_DIR) return
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  await locator.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` })
}

test('capture screenshot upload limit', async ({ page }) => {
  test.skip(!process.env.E2E_DATABASE_URL, 'needs E2E_DATABASE_URL to grant Hylo Pro')
  const groupId = sql(`SELECT id FROM groups WHERE slug = '${PRO_GROUP}'`)
  expect(groupId).toMatch(/^\d+$/)
  sql(`DELETE FROM hylo_pro_subscriptions WHERE note = '${NOTE}'`)
  sql(`INSERT INTO hylo_pro_subscriptions (group_id, source, status, tier, note) VALUES (${groupId}, 'manual', 'active', 'pro', '${NOTE}')`)

  try {
    // Pro group: a 2 GB file is over the 1 GB limit
    const pro = await openPostEditor(page, PRO_GROUP)
    const status = pro.modal.getByTestId('attachment-drop-zone-status')
    await dropFileOfSize(pro.description, { name: 'talk.mp4', type: 'video/mp4', size: 2 * 1024 * 1024 * 1024 })
    await expect(status).toHaveText('Files must be smaller than 1 GB', uiTimeout)
    await screenshot(pro.modal.getByTestId('attachment-drop-zone'), 'issue-1761-pro-group-1gb-limit')

    // Group without Pro: a 60 MB file is over the 50 MB limit
    const free = await openPostEditor(page, FREE_GROUP)
    const freeStatus = free.modal.getByTestId('attachment-drop-zone-status')
    await dropFileOfSize(free.description, { name: 'talk.mp4', type: 'video/mp4', size: 60 * 1024 * 1024 })
    await expect(freeStatus).toHaveText('Files must be smaller than 50 MB', uiTimeout)
    await screenshot(free.modal.getByTestId('attachment-drop-zone'), 'issue-1761-free-group-50mb-limit')
  } finally {
    sql(`DELETE FROM hylo_pro_subscriptions WHERE note = '${NOTE}'`)
  }
})
