import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import { Comment } from './Comment'
import { AllTheProviders } from 'util/testing/reactTestingLibraryExtended'

// local timezone is UTC so tests on CI match dev machines
describe('Timezone', () => {
  it('should always be UTC', () => {
    expect(new Date().getTimezoneOffset()).toBe(0)
  })
})

describe('Comment', () => {
  const createdAt = new Date(2023, 6, 23, 16, 30)
  const epochTime = createdAt.getTime()

  beforeAll(() => {
    jest.spyOn(Date.prototype, 'getTime').mockImplementation(() => epochTime)
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  const props = {
    comment: {
      id: '1',
      text: '<p>text of the comment</p>',
      creator: {
        id: 1,
        name: 'Joe Smith',
        avatarUrl: 'foo.jpg'
      },
      attachments: [],
      createdAt: createdAt,
      childComments: []
    },
    canModerate: false,
    currentUser: {
      id: 2
    },
    slug: 'foo',
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
    removeComment: jest.fn(),
    onReplyComment: jest.fn(),
    t: (str) => str
  }

  it('renders correctly', () => {
    render(<Comment {...props} />, { wrapper: AllTheProviders })
    expect(screen.getByText('Joe Smith')).toBeInTheDocument()
    expect(screen.getByText('text of the comment')).toBeInTheDocument()
    expect(screen.getByText(/commented/)).toBeInTheDocument()
  })

  it('renders correctly when editing', () => {
    render(<Comment {...props} />, { wrapper: AllTheProviders })
    fireEvent.click(screen.getByLabelText('Edit'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('displays image attachments', () => {
    const comment = {
      ...props.comment,
      attachments: [
        { url: 'foo.png', attachmentType: 'image' }
      ]
    }
    render(<Comment {...props} comment={comment} />, { wrapper: AllTheProviders })
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('does not display the delete menu when deleteComment is not defined', () => {
    render(<Comment {...props} deleteComment={undefined} />, { wrapper: AllTheProviders })
    expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument()
  })

  it('displays the delete menu when deleteComment is defined', () => {
    render(<Comment {...props} currentUser={{ id: 1 }} />, { wrapper: AllTheProviders })
    expect(screen.getByLabelText('Delete')).toBeInTheDocument()
  })

  it('displays the remove menu when removeComment is defined', () => {
    render(<Comment {...props} canModerate />, { wrapper: AllTheProviders })
    expect(screen.getByLabelText('Remove')).toBeInTheDocument()
  })

  it('does not display the remove menu when removeComment is not defined', () => {
    render(<Comment {...props} currentUser={{ id: 1 }} canModerate removeComment={undefined} />, { wrapper: AllTheProviders })
    expect(screen.queryByLabelText('Remove')).not.toBeInTheDocument()
  })

  describe('handleEditComment', () => {
    it('shows edit form when edit button is clicked', () => {
      render(<Comment {...props} currentUser={{ id: 1 }} />, { wrapper: AllTheProviders })
      fireEvent.click(screen.getByLabelText('Edit'))
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('handleEditSave', () => {
    it('calls props.updateComment when save button is clicked', () => {
      render(<Comment {...props} currentUser={{ id: 1 }} />, { wrapper: AllTheProviders })
      fireEvent.click(screen.getByLabelText('Edit'))
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated comment' } })
      fireEvent.click(screen.getByText('Save'))
      expect(props.updateComment).toHaveBeenCalled()
    })
  })
})
