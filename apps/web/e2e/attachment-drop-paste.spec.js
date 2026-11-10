import { test, expect } from '@playwright/test'
import { waitPastRootSessionLoading } from './helpers/waitPastRootSessionLoading.js'

/**
 * Drag and drop / paste of images and files onto composers (issue #1460).
 *
 * Network stubs (CI has no Filestack key, and the local backend can't fetch
 * Filestack's CDN):
 * - upload.filestackapi.com: answers filestack-js's multipart upload
 *   (start → upload → S3 PUT → complete) with a fake handle, so the real
 *   `filestack.upload()` code path runs in the browser.
 * - /noo/upload: answers like the backend after storing the file, with a URL
 *   on e2e-uploads.hylo.test, which is served the test PNG.
 * Composers are not submitted. The comment case creates its own discussion so it
 * does not share seeded post 1 (also used by logged-out tests).
 */

test.describe.configure({ timeout: 180000 })

const uiTimeout = { timeout: 60000 }
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR
const PUBLIC_GROUP = 'e2e-public-group'

async function graphql (page, query, variables) {
  const res = await page.request.post('/noo/graphql', { data: { query, variables } })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

/** A discussion in the public group, owned by the signed-in E2E user. */
async function createDiscussionPost (page, title) {
  const { group } = await graphql(page, 'query ($slug: String) { group(slug: $slug) { id } }', { slug: PUBLIC_GROUP })
  const { createPost } = await graphql(page,
    'mutation ($data: PostInput) { createPost(data: $data) { id } }',
    { data: { type: 'discussion', title, details: '<p>Body</p>', groupIds: [group.id] } })
  return createPost.id
}

// 8x8 solid teal PNG
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPgPTwfK2IYWhIAtVVbwYhHnKwAAAAASUVORK5CYII='
const PDF_B64 = Buffer.from('%PDF-1.4\n% e2e test file\n').toString('base64')

async function stubUploads (page) {
  const calls = { filestack: [], hylo: [] }
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
    calls.filestack.push(pathname)
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
      return json({ handle: `e2eHandle${calls.filestack.length}`, url: 'https://cdn.filestackcontent.com/e2eHandle', filename, mimetype, status: 'Stored' })
    }
    return json({})
  })

  await page.route('**/noo/upload', async route => {
    const params = route.request().postDataJSON()
    calls.hylo.push(params)
    const isImage = /\.(png|jpe?g|gif)$/i.test(params.filename || '')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        type: params.type,
        id: params.id,
        url: `https://e2e-uploads.hylo.test/${params.filename}`,
        attachmentType: isImage ? 'image' : 'file'
      })
    })
  })

  await page.route('https://e2e-uploads.hylo.test/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG_B64, 'base64') }))

  return calls
}

/** A DataTransfer in the page holding one file, like the OS gives a drag from the desktop */
function makeDataTransfer (page, { b64, name, type }) {
  return page.evaluateHandle(({ b64, name, type }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const dataTransfer = new window.DataTransfer()
    dataTransfer.items.add(new window.File([bytes], name, { type }))
    return dataTransfer
  }, { b64, name, type })
}

async function dragOver (target, dataTransfer) {
  await target.dispatchEvent('dragenter', { dataTransfer })
  await target.dispatchEvent('dragover', { dataTransfer })
}

async function pasteFile (target, { b64, name, type }) {
  return target.evaluate((el, { b64, name, type }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const clipboardData = new window.DataTransfer()
    clipboardData.items.add(new window.File([bytes], name, { type }))
    const event = new window.ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
    el.dispatchEvent(event)
    return event.defaultPrevented
  }, { b64, name, type })
}

async function screenshot (page, locator, name) {
  if (!SCREENSHOT_DIR) return
  await locator.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` })
}

const imageFile = name => ({ b64: PNG_B64, name, type: 'image/png' })
const pdfFile = name => ({ b64: PDF_B64, name, type: 'application/pdf' })

test('post editor: dropped image becomes an image attachment, pasted PDF a file attachment', async ({ page }) => {
  const calls = await stubUploads(page)
  const project = test.info().project.name
  await page.goto(`/groups/${PUBLIC_GROUP}/all?create=post&newPostType=discussion`)
  await waitPastRootSessionLoading(page)
  const modal = page.locator('#create-modal-content')
  const description = modal.locator('.ProseMirror')
  await expect(description).toBeVisible(uiTimeout)
  await description.click()
  await description.pressSequentially('Dropping a picture')

  const png = `drop-${project}.png`
  const dataTransfer = await makeDataTransfer(page, imageFile(png))
  await dragOver(description, dataTransfer)
  const overlay = modal.getByTestId('attachment-drop-zone-overlay')
  await expect(overlay).toHaveText('Drop image here')
  await screenshot(page, modal.getByTestId('attachment-drop-zone'), 'issue-1460-post-drop-zone')

  await description.dispatchEvent('drop', { dataTransfer })
  await expect(overlay).toBeHidden()
  const imagePreview = modal.locator(`.image[style*="${png}"]`)
  await expect(imagePreview).toBeVisible(uiTimeout)
  // Attached, not inlined into the description
  await expect(description.locator('img')).toHaveCount(0)
  await expect(description).toContainText('Dropping a picture')
  expect(calls.filestack).toEqual(expect.arrayContaining(['/multipart/start', '/multipart/complete']))
  expect(calls.hylo[0]).toMatchObject({ type: 'post', filename: png })
  // The stored URL is the Filestack CDN link for the uploaded handle, as with the picker
  expect(calls.hylo[0].url).toMatch(/^https:\/\/cdn\.filestackcontent\.com\/e2eHandle\d+$/)

  const pdf = `notes-${project}.pdf`
  await description.click()
  expect(await pasteFile(description, pdfFile(pdf))).toBe(true)
  await expect(modal.getByText(pdf)).toBeVisible(uiTimeout)
  await expect(imagePreview).toBeVisible()
  await screenshot(page, modal.getByTestId('attachment-drop-zone'), 'issue-1460-post-attached')
})

test('chat: dropped image shows the drop zone and is attached to the message', async ({ page }) => {
  await stubUploads(page)
  const project = test.info().project.name
  await page.goto(`/groups/${PUBLIC_GROUP}/chat`)
  await waitPastRootSessionLoading(page)
  const composer = page.locator('.ChatEditorContent')
  const editor = composer.locator('.ProseMirror')
  await expect(editor).toBeVisible(uiTimeout)

  const png = `chat-${project}.png`
  const dataTransfer = await makeDataTransfer(page, imageFile(png))
  await dragOver(editor, dataTransfer)
  const zone = page.getByTestId('attachment-drop-zone').filter({ has: composer })
  await expect(zone.getByTestId('attachment-drop-zone-overlay')).toHaveText('Drop image here')
  await screenshot(page, zone, 'issue-1460-chat-drop-zone')

  await editor.dispatchEvent('drop', { dataTransfer })
  await expect(composer.locator(`.image[style*="${png}"]`)).toBeVisible(uiTimeout)
  await expect(composer.locator('.ProseMirror img')).toHaveCount(0)
  await expect(page.getByTestId('chat-send-button')).toBeEnabled()
  await screenshot(page, zone, 'issue-1460-chat-attached')
})

test('comment: pasted image and dropped file are attached to the comment', async ({ page }) => {
  const calls = await stubUploads(page)
  const project = test.info().project.name
  // `/` is a session-loading path, so this waits out checkLogin. Opening a group
  // post URL first skips that loader; the 60s editor wait then starts while auth
  // is still in flight and the comment form is not mounted yet.
  await page.goto('/')
  await waitPastRootSessionLoading(page)
  const postId = await createDiscussionPost(page, `Comment attachments ${project}`)
  await page.goto(`/post/${postId}`)
  await waitPastRootSessionLoading(page)
  const form = page.locator('.CommentForm').last()
  await expect(form).toBeVisible(uiTimeout)
  await form.scrollIntoViewIfNeeded()
  const editor = form.locator('.ProseMirror')
  await expect(editor).toBeVisible(uiTimeout)

  const png = `comment-${project}.png`
  await editor.click()
  expect(await pasteFile(editor, imageFile(png))).toBe(true)
  await expect(form.locator(`.image[style*="${png}"]`)).toBeVisible(uiTimeout)
  expect(calls.hylo[0]).toMatchObject({ type: 'comment', id: 'new', filename: png })

  const pdf = `comment-${project}.pdf`
  const dataTransfer = await makeDataTransfer(page, pdfFile(pdf))
  await dragOver(editor, dataTransfer)
  await expect(page.getByTestId('attachment-drop-zone-overlay')).toHaveText('Drop file here')
  await editor.dispatchEvent('drop', { dataTransfer })
  await expect(form.getByText(pdf)).toBeVisible(uiTimeout)
  await expect(editor.locator('img')).toHaveCount(0)
})

test('page editor: dropped image is inserted inline where it is dropped', async ({ page }) => {
  const calls = await stubUploads(page)
  const project = test.info().project.name
  await page.goto('/public/all?create=group')
  const dialog = page.getByRole('dialog', { name: 'Create a group' })
  await expect(dialog).toBeVisible(uiTimeout)
  await dialog.getByRole('button', { name: 'Welcome', exact: true }).click()
  const editor = dialog.locator('.hylo-page-html .ProseMirror')
  await expect(editor).toBeVisible(uiTimeout)
  await editor.click()
  await editor.pressSequentially('First line')
  await editor.press('Enter')
  await editor.pressSequentially('Second line')

  const png = `page-${project}.png`
  const dataTransfer = await makeDataTransfer(page, imageFile(png))
  const box = await editor.locator('p', { hasText: 'Second line' }).boundingBox()
  const at = { clientX: box.x + 1, clientY: box.y + box.height / 2 }
  await editor.dispatchEvent('dragenter', { dataTransfer, ...at })
  await editor.dispatchEvent('dragover', { dataTransfer, ...at })
  await editor.dispatchEvent('drop', { dataTransfer, ...at })

  const img = editor.locator(`img[src="https://e2e-uploads.hylo.test/${png}"]`)
  await expect(img).toBeVisible(uiTimeout)
  expect(calls.hylo[0]).toMatchObject({ type: 'welcomePage', filename: png })
  const html = await editor.innerHTML()
  expect(html.indexOf('First line')).toBeLessThan(html.indexOf(png))
  expect(html.indexOf(png)).toBeLessThan(html.indexOf('Second line'))
  // No attachment drop zone here: the image goes into the page content
  await expect(dialog.getByTestId('attachment-drop-zone-overlay')).toHaveCount(0)
  await screenshot(page, editor, 'issue-1460-page-inline')
})
