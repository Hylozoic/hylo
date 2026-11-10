import { renderHook } from '@testing-library/react'
import { uploadFile } from 'client/filestack'
import { UPLOAD_ATTACHMENT } from 'store/constants'
import useUploadFiles from './useUploadFiles'

const mockDispatch = jest.fn()

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}))

jest.mock('client/filestack', () => ({
  ...jest.requireActual('client/filestack'),
  uploadFile: jest.fn()
}))

describe('useUploadFiles', () => {
  beforeEach(() => {
    mockDispatch.mockReset()
    uploadFile.mockReset()
  })

  it('uploads to Filestack, then stores the file through /noo/upload', async () => {
    const png = new window.File(['x'], 'photo.png', { type: 'image/png' })
    uploadFile.mockResolvedValue({ url: 'https://cdn.filestackcontent.com/abc', filename: 'photo.png', mimetype: 'image/png', handle: 'abc' })
    mockDispatch.mockResolvedValue({ payload: { url: 'https://s3/photo.png', attachmentType: 'image', type: 'post', id: 'new' } })
    const onUploaded = jest.fn()

    const { result } = renderHook(() => useUploadFiles({ type: 'post' }))
    const { uploaded, failed } = await result.current([png], onUploaded)

    expect(uploadFile).toHaveBeenCalledWith(png)
    const action = mockDispatch.mock.calls[0][0]
    expect(action.type).toBe(UPLOAD_ATTACHMENT)
    expect(action.payload.api.params).toEqual({ type: 'post', id: 'new', url: 'https://cdn.filestackcontent.com/abc', filename: 'photo.png' })
    expect(action.meta.attachmentType).toBe('image')
    expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://s3/photo.png', attachmentType: 'image', filename: 'photo.png' }))
    expect(uploaded).toHaveLength(1)
    expect(failed).toHaveLength(0)
  })

  it('keeps going after a failure and reports it, whether the upload rejects or returns an error', async () => {
    const a = new window.File(['x'], 'a.pdf', { type: 'application/pdf' })
    const b = new window.File(['x'], 'b.pdf', { type: 'application/pdf' })
    const c = new window.File(['x'], 'c.pdf', { type: 'application/pdf' })
    uploadFile
      .mockRejectedValueOnce(new Error('filestack down'))
      .mockResolvedValue({ url: 'https://cdn/x', filename: 'x.pdf', mimetype: 'application/pdf' })
    mockDispatch
      .mockResolvedValueOnce({ error: true, payload: new Error('422') })
      .mockResolvedValueOnce({ payload: { url: 'https://s3/c.pdf', attachmentType: 'file' } })
    const onUploaded = jest.fn()
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useUploadFiles({ type: 'comment', id: 'new' }))
    const { uploaded, failed } = await result.current([a, b, c], onUploaded)

    expect(failed.map(f => f.file)).toEqual([a, b])
    expect(uploaded).toHaveLength(1)
    expect(onUploaded).toHaveBeenCalledTimes(1)
    expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://s3/c.pdf', attachmentType: 'file' }))
    console.error.mockRestore()
  })
})
