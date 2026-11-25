import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import UploadAttachmentButton from './UploadAttachmentButton'

const mockDispatch = jest.fn()
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}))

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))

// The picker "finishes" as soon as it opens, with one file picked by URL
jest.mock('client/filestack', () => ({
  ...jest.requireActual('client/filestack'),
  filestackPicker: ({ onUploadDone }) => ({
    open: () => onUploadDone({
      filesUploaded: [{ url: 'https://cdn.filestackcontent.com/abc123', filename: 'report.pdf', mimetype: 'application/pdf' }]
    })
  })
}))

// What fetchJSON rejects with when /noo/upload doesn't return a 200
function uploadError (status, body) {
  const error = new Error(body)
  error.response = { status, body }
  return error
}

function clickUpload (props = {}) {
  render(<UploadAttachmentButton type='post' id='new' attachmentType='file' onSuccess={jest.fn()} {...props} />)
  fireEvent.click(screen.getByTestId('upload-attachment-button'))
}

describe('UploadAttachmentButton', () => {
  beforeEach(() => {
    mockDispatch.mockReset()
    toast.error.mockClear()
  })

  it('tells the user when the remote site refused the download', async () => {
    const error = uploadError(422, JSON.stringify({ error: 'Download failed (403)', code: 'REMOTE_DOWNLOAD_FAILED' }))
    mockDispatch.mockRejectedValue(error)
    const onError = jest.fn()

    clickUpload({ onError })

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "We couldn't download that file. The site may not allow it. Try downloading it and uploading it directly."
    ))
    expect(onError).toHaveBeenCalledWith(error)
  })

  it('shows a generic message for other upload failures', async () => {
    mockDispatch.mockRejectedValue(uploadError(500, ''))

    clickUpload()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Upload failed. Please try again.'))
  })

  it('shows a message when the upload action resolves with an error', async () => {
    const error = uploadError(422, JSON.stringify({ error: 'Download failed (404)', code: 'REMOTE_DOWNLOAD_FAILED' }))
    mockDispatch.mockResolvedValue({ error: true, payload: error })

    clickUpload()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "We couldn't download that file. The site may not allow it. Try downloading it and uploading it directly."
    ))
  })

  it('passes a successful upload to onSuccess without an error message', async () => {
    mockDispatch.mockResolvedValue({ payload: { url: 'https://s3/report.pdf', attachmentType: 'file' } })
    const onSuccess = jest.fn()

    clickUpload({ onSuccess })

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(onSuccess.mock.calls[0][0].url).toEqual('https://s3/report.pdf')
    expect(toast.error).not.toHaveBeenCalled()
  })
})
