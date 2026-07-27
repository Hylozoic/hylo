/* eslint-disable no-unused-expressions */
import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import AttachmentManager from './AttachmentManager'
import { ImageManager } from './ImageManager'
import { ImagePreview } from './ImagePreview'
import { FileManager } from './FileManager'
import { FilePreview } from './FilePreview'

const minDefaultProps = {
  type: 'anything',
  loadAttachments: jest.fn(),
  addAttachment: jest.fn(),
  removeAttachment: jest.fn(),
  moveAttachment: jest.fn(),
  clearAttachments: jest.fn(),
  setAttachments: jest.fn()
}

const imageAttachments = [
  { attachmentType: 'image', url: 'https://nowhere/foo.png', id: 'img1' },
  { attachmentType: 'image', url: 'https://nowhere/bar.jpg', id: 'img2' }
]

const fileAttachments = [
  { attachmentType: 'file', url: 'https://nowhere/thing1.pdf', id: 'file1' },
  { attachmentType: 'file', url: 'https://nowhere/thing2.xls', id: 'file2' }
]

describe('AttachmentManager', () => {
  it('renders nothing with minProps', () => {
    render(<AttachmentManager {...minDefaultProps} />)
    expect(screen.queryByText(/Images/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Files/)).not.toBeInTheDocument()
  })

  it('renders nothing when empty for post type', () => {
    render(<AttachmentManager type='post' showLabel showLoading />)
    expect(screen.queryByText(/Images/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Files/)).not.toBeInTheDocument()
  })
})

describe('ImageManager', () => {
  it('renders correctly', () => {
    const props = {
      type: 'post',
      id: '1',
      showLabel: true,
      showAddButton: true,
      showLoading: true,
      uploadAttachmentPending: true,
      attachments: imageAttachments,
      addAttachment: jest.fn(),
      removeAttachment: jest.fn(),
      moveAttachment: jest.fn()
    }
    render(<ImageManager {...props} />)
    expect(screen.getByText('Images')).toBeInTheDocument()
    expect(screen.getByText('+')).toBeInTheDocument()
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })
})

describe('ImagePreview', () => {
  it('renders correctly', () => {
    const props = {
      attachment: { url: 'https://nowhere/foo.png', attachmentType: 'image', id: 'img1' },
      removeImage: jest.fn()
    }
    render(<ImagePreview {...props} />)
    expect(document.querySelector('.image')).toBeInTheDocument()
  })
})

describe('FileManager', () => {
  it('renders correctly', () => {
    const props = {
      type: 'post',
      id: '1',
      showLabel: true,
      showAddButton: true,
      showLoading: true,
      uploadAttachmentPending: true,
      attachments: fileAttachments,
      addAttachment: jest.fn(),
      removeAttachment: jest.fn()
    }
    render(<FileManager {...props} />)
    expect(screen.getByText('Files')).toBeInTheDocument()
    expect(screen.getAllByText(/thing\d\./).length).toBe(2)
    expect(screen.getByText('Add File')).toBeInTheDocument()
  })
})

describe('FilePreview', () => {
  it('renders correctly', () => {
    const props = {
      attachment: { url: 'https://nowhere/foo.pdf', attachmentType: 'file' },
      removeFile: jest.fn(),
      fileSize: '23.3mb'
    }
    render(<FilePreview {...props} />)
    expect(screen.getByText('foo.pdf')).toBeInTheDocument()
    expect(screen.getByText('23.3mb')).toBeInTheDocument()
  })
})
