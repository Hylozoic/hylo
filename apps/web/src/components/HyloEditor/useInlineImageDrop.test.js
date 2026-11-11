import { renderHook, waitFor } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import useUploadFiles from 'hooks/useUploadFiles'
import useInlineImageDrop from './useInlineImageDrop'

const mockUploadFiles = jest.fn()
jest.mock('hooks/useUploadFiles', () => jest.fn(() => mockUploadFiles))

const png = new window.File(['x'], 'photo.png', { type: 'image/png' })
const pdf = new window.File(['x'], 'doc.pdf', { type: 'application/pdf' })
const transfer = files => ({ types: ['Files'], files, items: [], getData: () => '' })

function setup ({ enabled = true, content = '<p>Hello</p><p>World</p>' } = {}) {
  const editor = new Editor({ extensions: [StarterKit, Image], content })
  renderHook(() => useInlineImageDrop(editor, { type: 'group', id: '42', enabled }))
  const run = (prop, ...args) => editor.view.someProp(prop, f => f(editor.view, ...args))
  return { editor, run }
}

describe('useInlineImageDrop', () => {
  beforeEach(() => {
    mockUploadFiles.mockReset()
    mockUploadFiles.mockImplementation(async (files, onUploaded) => {
      files.forEach(f => onUploaded({ url: `https://s3/${f.name}`, attachmentType: 'image', filename: f.name }))
      return { uploaded: files, failed: [] }
    })
  })

  it('uploads with the toolbar Image button\'s type and id', () => {
    setup()
    expect(useUploadFiles).toHaveBeenCalledWith({ type: 'group', id: '42' })
  })

  it('inserts a dropped image where it was dropped', async () => {
    const { editor, run } = setup()
    // jsdom has no layout: say the drop landed at the start of "World"
    const worldStart = editor.state.doc.child(0).nodeSize + 1
    editor.view.posAtCoords = () => ({ pos: worldStart, inside: -1 })
    const event = { dataTransfer: transfer([png]), preventDefault: jest.fn(), clientX: 0, clientY: 0 }

    expect(run('handleDrop', event, null, false)).toBe(true)
    expect(event.preventDefault).toHaveBeenCalled()
    await waitFor(() => expect(editor.getHTML()).toContain('src="https://s3/photo.png"'))
    const html = editor.getHTML()
    expect(html.indexOf('Hello')).toBeLessThan(html.indexOf('photo.png'))
    expect(html.indexOf('photo.png')).toBeLessThan(html.indexOf('World'))
  })

  it('inserts a pasted image at the cursor, and only uploads images', async () => {
    const { editor, run } = setup({ content: '<p>Hello</p>' })
    editor.commands.setTextSelection(6)
    const event = { clipboardData: transfer([png, pdf]), preventDefault: jest.fn() }

    expect(run('handlePaste', event)).toBe(true)
    await waitFor(() => expect(editor.getHTML()).toContain('src="https://s3/photo.png"'))
    expect(mockUploadFiles.mock.calls[0][0]).toEqual([png])
  })

  it('leaves text pastes and moves within the editor alone', () => {
    const { run } = setup()
    expect(run('handlePaste', { clipboardData: { types: ['text/plain'], files: [], getData: type => type === 'text/plain' ? 'hi' : '' } })).toBeFalsy()
    expect(run('handleDrop', { dataTransfer: transfer([png]) }, null, true)).toBeFalsy()
    expect(mockUploadFiles).not.toHaveBeenCalled()
  })

  it('does nothing when the extended toolbar is off', () => {
    const { run } = setup({ enabled: false })
    expect(run('handlePaste', { clipboardData: transfer([png]), preventDefault: jest.fn() })).toBeFalsy()
    expect(mockUploadFiles).not.toHaveBeenCalled()
  })
})
