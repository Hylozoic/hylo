import React from 'react'
import { render, screen, fireEvent, AllTheProviders, waitFor } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import Comment from './Comment'

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })

  const reduxState = { orm: ormSession.state, pending: {} }

  return AllTheProviders(reduxState)
}

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
        id: '1',
        name: 'Joe Smith',
        avatarUrl: 'foo.jpg'
      },
      attachments: [],
      createdAt,
      childComments: []
    },
    post: {
      id: 1,
      groups: []
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
    render(<Comment {...props} />, { wrapper: testProviders() })
    expect(screen.getByText('Joe Smith')).toBeInTheDocument()
    expect(screen.getByText('text of the comment')).toBeInTheDocument()
    expect(screen.getByText(/commented/)).toBeInTheDocument()
  })

  it('renders correctly when editing', () => {
    render(<Comment {...props} />, { wrapper: testProviders() })
    fireEvent.click(screen.getByTestId('Edit'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('displays image attachments', () => {
    const comment = {
      ...props.comment,
      attachments: [
        { url: 'foo.png', attachmentType: 'image' }
      ]
    }
    render(<Comment {...props} comment={comment} />, { wrapper: testProviders() })
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('displays the delete menu', () => {
    render(<Comment {...props} currentUser={{ id: 1 }} />, { wrapper: testProviders() })
    expect(screen.getByTestId('Delete')).toBeInTheDocument()
  })

  it('displays the remove menu when canModerate is defined', () => {
    render(<Comment {...props} canModerate />, { wrapper: testProviders() })
    expect(screen.getByTestId('Delete')).toBeInTheDocument()
  })

  describe('handleEditComment', () => {
    it('shows edit form when edit button is clicked', async () => {
      render(<Comment {...props} currentUser={{ id: 1 }} />, { wrapper: testProviders() })
      fireEvent.click(screen.getByTestId('Edit'))
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      })
    })
  })

  describe('handleEditSave', () => {
    // TODO: how to test HyloEditor?
    it.skip('calls props.updateComment when save button is clicked', async () => {
      render(<Comment {...props} currentUser={{ id: 1 }} />, { wrapper: testProviders() })
      fireEvent.click(screen.getByTestId('Edit'))
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated comment' } }) // XXX: doesnt work on contenteditable
      // fireEvent.click(screen.getByTestId('Save'))
      // Hit enter to save the comment
      await waitFor(() => {
        expect(props.updateComment).toHaveBeenCalled()
      })
    })
  })
})
