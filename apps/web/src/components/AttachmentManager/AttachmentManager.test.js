/* eslint-disable no-unused-expressions */
import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import userEvent from '@testing-library/user-event'
import AttachmentManager from './AttachmentManager'
import { ImageManager } from './ImageManager'
import { ImagePreview } from './ImagePreview'
import { FileManager } from './FileManager'
import { FilePreview } from './FilePreview'

// Mock the store selectors
jest.mock('./AttachmentManager.store', () => ({
  ...jest.requireActual('./AttachmentManager.store'),
  getAttachments: jest.fn(),
  getAttachmentsFromObject: jest.fn().mockReturnValue([]),
  getUploadAttachmentPending: jest.fn().mockReturnValue(false)
}))

// Import the mocked functions for controlling them in tests
import { getAttachments, getAttachmentsFromObject, getUploadAttachmentPending } from './AttachmentManager.store'

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

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  const reduxState = { orm: ormSession.state }
  return AllTheProviders(reduxState)
}

describe('AttachmentManager', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
    getAttachments.mockReturnValue([])
    getAttachmentsFromObject.mockReturnValue([])
    getUploadAttachmentPending.mockReturnValue(false)
  })

  it('renders nothing with minProps', () => {
    render(<AttachmentManager {...minDefaultProps} />, { wrapper: testProviders() })
    expect(screen.queryByText(/Images/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Files/)).not.toBeInTheDocument()
  })

  describe('as used with PostEditor', () => {
    test('when empty', () => {
      render(<AttachmentManager {...postEditorCaseDefaultProps} />, { wrapper: testProviders() })
      expect(screen.queryByText(/Images/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Files/)).not.toBeInTheDocument()
    })

    test('with attachments', () => {
      getAttachments.mockReturnValue(attachments)
      render(<AttachmentManager {...postEditorCaseDefaultProps} />, { wrapper: testProviders() })
      expect(screen.getByText('Images')).toBeInTheDocument()
      expect(screen.getByText('Files')).toBeInTheDocument()
      expect(screen.getAllByRole('button')).toHaveLength(2)
      expect(screen.getAllByText(/thing\d\./).length).toBe(2)
    })

    test('when loading', () => {
      getUploadAttachmentPending.mockReturnValue(true)
      render(<AttachmentManager uploadAttachmentPending {...postEditorCaseDefaultProps} />, { wrapper: testProviders() })
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })
  })

  describe('as used with CommentForm', () => {
    test('when empty', () => {
      render(<AttachmentManager {...commentFormCaseDefaultProps} />, { wrapper: testProviders() })
      expect(screen.queryByText(/Images/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Files/)).not.toBeInTheDocument()
    })

    test('with attachments', () => {
      getAttachments.mockReturnValue(attachments)
      render(<AttachmentManager attachments={attachments} {...commentFormCaseDefaultProps} />, { wrapper: testProviders() })
      expect(screen.getAllByRole('button')).toHaveLength(2)
      expect(screen.getAllByText(/thing\d\./).length).toBe(2)
    })
  })

  describe('when attachmentType', () => {
    test('"image" with attachments', () => {
      getAttachments.mockReturnValue(attachments)
      render(<AttachmentManager attachmentType='image' attachments={attachments} {...minDefaultProps} />, { wrapper: testProviders() })
      expect(screen.getAllByRole('button')).toHaveLength(2)
      expect(screen.queryByText(/thing\d\./)).not.toBeInTheDocument()
    })

    test('"file" with attachments', () => {
      getAttachments.mockReturnValue(attachments)
      render(<AttachmentManager attachmentType='file' attachments={attachments} {...minDefaultProps} />, { wrapper: testProviders() })
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
    render(<ImageManager {...props} />, { wrapper: testProviders() })
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
    render(<ImagePreview {...props} />, { wrapper: testProviders() })
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
    render(<FileManager {...props} />, { wrapper: testProviders() })
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
    render(<FilePreview {...props} />, { wrapper: testProviders() })
    expect(screen.getByText('foo.pdf')).toBeInTheDocument()
    expect(screen.getByText('23.3mb')).toBeInTheDocument()
  })
})
