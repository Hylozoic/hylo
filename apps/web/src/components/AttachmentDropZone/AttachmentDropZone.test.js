import React from 'react'
import { act, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import useUploadFiles from 'hooks/useUploadFiles'
import AttachmentDropZone from './AttachmentDropZone'

const mockUploadFiles = jest.fn()
jest.mock('hooks/useUploadFiles', () => jest.fn(() => mockUploadFiles))

const png = new window.File(['x'], 'photo.png', { type: 'image/png' })
const pdf = new window.File(['x'], 'doc.pdf', { type: 'application/pdf' })
const font = new window.File(['x'], 'font.woff2', { type: 'font/woff2' })

const dragData = files => ({
  types: ['Files'],
  files,
  items: files.map(f => ({ kind: 'file', type: f.type, getAsFile: () => f })),
  dropEffect: 'none'
})

function renderZone (props = {}) {
  const onAttachment = jest.fn()
  const onLoadingChange = jest.fn()
  render(
    <AttachmentDropZone type='post' id='new' onAttachment={onAttachment} onLoadingChange={onLoadingChange} {...props}>
      <textarea data-testid='input' />
    </AttachmentDropZone>
  )
  return { onAttachment, onLoadingChange, input: screen.getByTestId('input') }
}

describe('AttachmentDropZone', () => {
  beforeEach(() => {
    mockUploadFiles.mockReset()
    mockUploadFiles.mockImplementation(async (files, onUploaded) => {
      const uploaded = files.map(f => ({ url: `https://s3/${f.name}`, attachmentType: f.type.startsWith('image/') ? 'image' : 'file' }))
      uploaded.forEach(u => onUploaded(u))
      return { uploaded, failed: [] }
    })
  })

  it('uploads with the given attachment type and id', () => {
    renderZone({ type: 'comment', id: 'new' })
    expect(useUploadFiles).toHaveBeenCalledWith({ type: 'comment', id: 'new' })
  })

  it('shows "Drop image here" while images are dragged over, and hides it on leave', () => {
    const { input } = renderZone()
    fireEvent.dragEnter(input, { dataTransfer: dragData([png]) })
    expect(screen.getByText('Drop image here')).toBeInTheDocument()
    fireEvent.dragLeave(input, { dataTransfer: dragData([png]) })
    expect(screen.queryByText('Drop image here')).not.toBeInTheDocument()
  })

  it('shows "Drop file here" for other files, and nothing for text drags', () => {
    const { input } = renderZone()
    fireEvent.dragEnter(input, { dataTransfer: { types: ['text/plain'], items: [] } })
    expect(screen.queryByTestId('attachment-drop-zone-overlay')).not.toBeInTheDocument()
    fireEvent.dragEnter(input, { dataTransfer: dragData([png, pdf]) })
    expect(screen.getByText('Drop file here')).toBeInTheDocument()
  })

  it('uploads dropped files and adds each as an attachment', async () => {
    const { input, onAttachment, onLoadingChange } = renderZone()
    fireEvent.dragEnter(input, { dataTransfer: dragData([png, pdf]) })
    const notCancelled = fireEvent.drop(input, { dataTransfer: dragData([png, pdf]) })

    expect(notCancelled).toBe(false) // default prevented: the browser doesn't open the file
    expect(screen.queryByText('Drop file here')).not.toBeInTheDocument()
    await waitFor(() => expect(onAttachment).toHaveBeenCalledTimes(2))
    expect(mockUploadFiles.mock.calls[0][0]).toEqual([png, pdf])
    expect(onAttachment).toHaveBeenCalledWith({ url: 'https://s3/photo.png', attachmentType: 'image' })
    expect(onAttachment).toHaveBeenCalledWith({ url: 'https://s3/doc.pdf', attachmentType: 'file' })
    expect(onLoadingChange).toHaveBeenCalledWith(true, 'file')
    await waitFor(() => expect(onLoadingChange).toHaveBeenLastCalledWith(false))
  })

  it('keeps file drops away from the editor inside', async () => {
    const innerDrop = jest.fn()
    render(
      <AttachmentDropZone type='post' onAttachment={jest.fn()}>
        <div data-testid='editor' onDrop={innerDrop} />
      </AttachmentDropZone>
    )
    fireEvent.drop(screen.getByTestId('editor'), { dataTransfer: dragData([png]) })
    expect(innerDrop).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('Uploading...')).not.toBeInTheDocument())
  })

  it('does not upload unsupported files and says why', async () => {
    const { input, onAttachment } = renderZone()
    fireEvent.drop(input, { dataTransfer: dragData([font]) })
    expect(await screen.findByText('That type of file can\'t be attached')).toBeInTheDocument()
    expect(mockUploadFiles).not.toHaveBeenCalled()
    expect(onAttachment).not.toHaveBeenCalled()
  })

  it('reports failed uploads', async () => {
    mockUploadFiles.mockResolvedValue({ uploaded: [], failed: [{ file: png }] })
    const { input } = renderZone()
    await act(async () => {
      fireEvent.drop(input, { dataTransfer: dragData([png]) })
    })
    expect(await screen.findByText('Upload failed. Please try again.')).toBeInTheDocument()
  })

  it('uploads pasted images', async () => {
    const { input, onAttachment } = renderZone()
    const notCancelled = fireEvent.paste(input, { clipboardData: { types: ['Files'], files: [png], getData: () => '' } })
    expect(notCancelled).toBe(false)
    await waitFor(() => expect(onAttachment).toHaveBeenCalledWith({ url: 'https://s3/photo.png', attachmentType: 'image' }))
    await waitFor(() => expect(screen.queryByText('Uploading...')).not.toBeInTheDocument())
  })

  it('leaves text pastes alone', () => {
    const { input } = renderZone()
    const notCancelled = fireEvent.paste(input, { clipboardData: { types: ['text/plain'], files: [], getData: () => 'hello' } })
    expect(notCancelled).toBe(true)
    expect(mockUploadFiles).not.toHaveBeenCalled()
  })

  it('ignores drops while disabled but still stops the browser opening the file', () => {
    const { input } = renderZone({ disabled: true })
    fireEvent.dragEnter(input, { dataTransfer: dragData([png]) })
    expect(screen.queryByTestId('attachment-drop-zone-overlay')).not.toBeInTheDocument()
    const notCancelled = fireEvent.drop(input, { dataTransfer: dragData([png]) })
    expect(notCancelled).toBe(false)
    expect(mockUploadFiles).not.toHaveBeenCalled()
  })
})
