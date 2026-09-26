/* eslint-env jest */
import React from 'react'
import { fireEvent } from '@testing-library/react'
import { render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import { filestackPicker } from 'client/filestack'
import uploadAttachment from 'store/actions/uploadAttachment'
import { CHAT_ID_FOR_NEW } from 'components/AttachmentManager/AttachmentManager.store'
import UploadAttachmentButton from './UploadAttachmentButton'

jest.mock('client/filestack', () => ({
  ...jest.requireActual('client/filestack'),
  filestackPicker: jest.fn()
}))

jest.mock('store/actions/uploadAttachment', () => jest.fn())

const pickedFile = { url: 'https://cdn.example.com/abc', filename: 'photo.png', mimetype: 'image/png' }

function pickerThatUploads (result) {
  filestackPicker.mockImplementation(({ onUploadDone }) => ({
    open: () => onUploadDone(result)
  }))
}

describe('UploadAttachmentButton', () => {
  beforeEach(() => {
    filestackPicker.mockReset()
    uploadAttachment.mockReset()
  })

  it('calls onError when the upload request fails', async () => {
    pickerThatUploads({ filesUploaded: [pickedFile] })
    uploadAttachment.mockImplementation(() => ({ type: 'TEST_UPLOAD', payload: Promise.reject(new Error('offline')) }))
    const onError = jest.fn()
    const onSuccess = jest.fn()

    render(<UploadAttachmentButton type='post' attachmentType='image' onError={onError} onSuccess={onSuccess} />)
    fireEvent.click(screen.getByTestId('upload-attachment-button'))

    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls onError when the picker reports failed files', async () => {
    pickerThatUploads({ filesUploaded: [], filesFailed: [pickedFile] })
    const onError = jest.fn()

    render(<UploadAttachmentButton type='post' attachmentType='image' onError={onError} onSuccess={jest.fn()} />)
    fireEvent.click(screen.getByTestId('upload-attachment-button'))

    await waitFor(() => expect(onError).toHaveBeenCalled())
  })

  it('uploads chat attachments as a new post while keeping the chat bucket id', async () => {
    pickerThatUploads({ filesUploaded: [pickedFile] })
    uploadAttachment.mockImplementation(() => ({ type: 'TEST_UPLOAD', payload: { url: pickedFile.url } }))
    const onSuccess = jest.fn()

    render(<UploadAttachmentButton type='post' id={CHAT_ID_FOR_NEW} attachmentType='image' onSuccess={onSuccess} />)
    fireEvent.click(screen.getByTestId('upload-attachment-button'))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(uploadAttachment).toHaveBeenCalledWith('post', CHAT_ID_FOR_NEW, expect.objectContaining({ url: pickedFile.url }), 'new')
  })
})
