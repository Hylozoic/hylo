/* eslint-disable no-unused-expressions */
import React from 'react'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import userEvent from '@testing-library/user-event'
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

const postEditorCaseDefaultProps = {
  ...minDefaultProps,
  type: 'post',
  showLabel: true,
  showLoading: true,
  showsAddButton: true
}

const commentFormCaseDefaultProps = {
  ...minDefaultProps,
  type: 'comment'
}

const imageAttachments = [
  { attachmentType: 'image', url: 'https://nowhere/foo.png' },
  { attachmentType: 'image', url: 'https://nowhere/bar.jpg' }
]

const fileAttachments = [
  { attachmentType: 'file', url: 'https://nowhere/thing1.pdf' },
  { attachmentType: 'file', url: 'https://nowhere/thing2.xls' }
]

const attachments = [
  ...imageAttachments,
  ...fileAttachments
]

describe('AttachmentManager', () => {
  it('renders nothing with minProps', () => {
    render(<AttachmentManager {...minDefaultProps} />)
    expect(screen.queryByText(/Images/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Files/)).not.toBeInTheDocument()
  })

  describe('as used with PostEditor', () => {
    test('when empty', () => {
      render(<AttachmentManager {...postEditorCaseDefaultProps} />)
      expect(screen.queryByText(/Images/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Files/)).not.toBeInTheDocument()
    })

    test('with attachments', () => {
      render(<AttachmentManager attachments={attachments} {...postEditorCaseDefaultProps} />)
      expect(screen.getByText('Images')).toBeInTheDocument()
      expect(screen.getByText('Files')).toBeInTheDocument()
      expect(screen.getAllByRole('button')).toHaveLength(2)
      expect(screen.getAllByText(/thing\d\./).length).toBe(2)
    })

    test('when loading', () => {
      render(<AttachmentManager uploadAttachmentPending {...postEditorCaseDefaultProps} />)
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })
  })

  describe('as used with CommentForm', () => {
    test('when empty', () => {
      render(<AttachmentManager {...commentFormCaseDefaultProps} />)
      expect(screen.queryByText(/Images/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Files/)).not.toBeInTheDocument()
    })

    test('with attachments', () => {
      render(<AttachmentManager attachments={attachments} {...commentFormCaseDefaultProps} />)
      expect(screen.getAllByRole('button')).toHaveLength(2)
      expect(screen.getAllByText(/thing\d\./).length).toBe(2)
    })
  })

  describe('when attachmentType', () => {
    test('"image" with attachments', () => {
      render(<AttachmentManager attachmentType='image' attachments={attachments} {...minDefaultProps} />)
      expect(screen.getAllByRole('button')).toHaveLength(2)
      expect(screen.queryByText(/thing\d\./)).not.toBeInTheDocument()
    })

    test('"file" with attachments', () => {
      render(<AttachmentManager attachmentType='file' attachments={attachments} {...minDefaultProps} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.getAllByText(/thing\d\./).length).toBe(2)
    })
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
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByText('+')).toBeInTheDocument()
  })
})

describe('ImagePreview', () => {
  it('renders correctly', () => {
    const props = {
      attachment: { url: 'https://nowhere/foo.png', attachmentType: 'image' },
      removeImage: jest.fn()
    }
    render(<ImagePreview {...props} />)
    expect(screen.getByRole('button')).toHaveClass('image')
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
