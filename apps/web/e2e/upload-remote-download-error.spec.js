import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Issue #1804: when the backend can't download an attachment because the remote
 * site refuses it, /noo/upload answers 422 { code: 'REMOTE_DOWNLOAD_FAILED' }
 * and the composer tells the user why, instead of failing silently.
 *
 * Network stubs: upload.filestackapi.com answers filestack-js's multipart upload
 * (as in attachment-drop-paste.spec.js) and /noo/upload answers with the
 * backend's remote-download error. The post is not submitted.
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR
const PUBLIC_GROUP = 'e2e-public-group'
const PDF_B64 = Buffer.from('%PDF-1.4\n% e2e test file\n').toString('base64')
const MESSAGE = "We couldn't download that file. The site may not allow it. Try downloading it and uploading it directly."

async function stubUploads (page) {
  const calls = { hylo: [] }
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Expose-Headers': 'ETag'
  }

  await page.route('https://upload.filestackapi.com/**', async route => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const json = body => route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    if (pathname === '/multipart/start') {
      return json({ uri: '/e2e/upload', region: 'us-east-1', upload_id: 'e2e-upload', location_url: 'upload.filestackapi.com' })
    }
    if (pathname === '/multipart/upload') {
      return json({ url: 'https://upload.filestackapi.com/e2e-s3-part', headers: {} })
    }
    if (pathname === '/e2e-s3-part') {
      return route.fulfill({ status: 200, headers: { ...cors, ETag: '"e2e-etag"' }, body: '' })
    }
    if (pathname === '/multipart/complete') {
      const { filename, mimetype } = request.postDataJSON() || {}
      return json({ handle: 'e2eHandle1804', url: 'https://cdn.filestackcontent.com/e2eHandle1804', filename, mimetype, status: 'Stored' })
    }
    return json({})
  })

  await page.route('**/noo/upload', async route => {
    calls.hylo.push(route.request().postDataJSON())
    return route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Download failed (403)', code: 'REMOTE_DOWNLOAD_FAILED' })
    })
  })

  return calls
}

test('post editor: a file the remote site refuses shows why the upload failed', async ({ page }) => {
  const calls = await stubUploads(page)
  const project = test.info().project.name
  await page.goto(`/groups/${PUBLIC_GROUP}/all?create=post&newPostType=discussion`)
  await waitPastRootSessionLoading(page)
  const modal = page.locator('#create-modal-content')
  const description = modal.locator('.ProseMirror')
  await expect(description).toBeVisible(uiTimeout)

  const filename = `refused-${project}.pdf`
  const dataTransfer = await page.evaluateHandle(({ b64, name }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const dt = new window.DataTransfer()
    dt.items.add(new window.File([bytes], name, { type: 'application/pdf' }))
    return dt
  }, { b64: PDF_B64, name: filename })
  await description.dispatchEvent('dragenter', { dataTransfer })
  await description.dispatchEvent('dragover', { dataTransfer })
  await description.dispatchEvent('drop', { dataTransfer })

  const zone = modal.getByTestId('attachment-drop-zone')
  await expect(zone.getByText(MESSAGE)).toBeVisible(uiTimeout)
  await expect(modal.getByText(filename)).toHaveCount(0)
  expect(calls.hylo[0]).toMatchObject({ type: 'post', filename })

  if (SCREENSHOT_DIR) {
    await modal.screenshot({ path: `${SCREENSHOT_DIR}/issue-1804-drop-${project}.png` })
  }
})
