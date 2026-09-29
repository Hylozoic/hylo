import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
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
    const { container } = render(<Comment {...props} />, { wrapper: testProviders() })
    expect(screen.getByText('Joe Smith')).toBeInTheDocument()
    expect(container.textContent).toContain('text of the comment')
  })

  it('renders correctly when editing', () => {
    render(<Comment {...props} />, { wrapper: testProviders() })
    fireEvent.click(screen.getByTestId('Edit'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByTestId('Save')).toBeInTheDocument()
    expect(screen.getByTestId('Cancel')).toBeInTheDocument()
  })

  it('displays image attachments', () => {
    const comment = {
      ...props.comment,
      attachments: [
        { url: 'foo.png', attachmentType: 'image' }
      ]
    }
    render(<Comment {...props} comment={comment} />, { wrapper: testProviders() })
    // Avatar + attachment images both use role=img
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0)
  })

  it('displays the delete menu for the comment creator', () => {
    render(<Comment {...props} />, { wrapper: testProviders() })
    expect(screen.getByTestId('Delete')).toBeInTheDocument()
  })

  it('names the comment actions with translated labels', () => {
    render(<Comment {...props} />, { wrapper: testProviders() })
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('opens the reply form from the keyboard', () => {
    render(<Comment {...props} />, { wrapper: testProviders() })

    const reply = screen.getByRole('button', { name: 'Reply' })
    expect(reply).toHaveAttribute('tabindex', '0')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.keyDown(reply, { key: 'Enter' })
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('starts editing from the keyboard', () => {
    render(<Comment {...props} />, { wrapper: testProviders() })

    const edit = screen.getByRole('button', { name: 'Edit' })
    expect(edit).toHaveAttribute('tabindex', '0')
    fireEvent.keyDown(edit, { key: ' ' })
    expect(screen.getByTestId('Save')).toBeInTheDocument()
  })

  describe('Report', () => {
    const otherPersonsComment = {
      ...props.comment,
      creator: { id: '7', name: 'Someone Else', avatarUrl: 'bar.jpg' }
    }
    const postInGroup = { id: '10', groups: [{ id: '3', slug: 'the-group' }] }

    function groupProviders () {
      const ormSession = orm.mutableSession(orm.getEmptyState())
      ormSession.Me.create({ id: '1' })
      ormSession.Group.create({ id: '3', slug: 'the-group', name: 'The Group' })
      ormSession.PlatformAgreement.create({ id: '5', type: 'anywhere', text: 'No harassment' })
      return AllTheProviders({ orm: ormSession.state, pending: {} })
    }

    it("isn't offered on your own comment", () => {
      render(<Comment {...props} post={postInGroup} />, { wrapper: groupProviders() })
      expect(screen.queryByTestId('Report')).not.toBeInTheDocument()
    })

    it("isn't offered when the post has no group to report to", () => {
      render(<Comment {...props} comment={otherPersonsComment} />, { wrapper: testProviders() })
      expect(screen.queryByRole('button', { name: 'Report comment' })).not.toBeInTheDocument()
    })

    it("sends a report on someone else's comment to the group's queue with the comment", async () => {
      let sent = null
      mockGraphqlServer.use(
        graphql.operation(({ query, variables }) => {
          if (!query.includes('createModerationAction')) return HttpResponse.json({ data: {} })
          sent = variables.data
          return HttpResponse.json({ data: { createModerationAction: { id: '99', postId: '10', groupId: '3', text: sent.text, anonymous: false, agreements: [], platformAgreements: [{ id: '5' }] } } })
        })
      )
      render(<Comment {...props} post={postInGroup} comment={otherPersonsComment} />, { wrapper: groupProviders() })
      fireEvent.click(screen.getByRole('button', { name: 'Report comment' }))
      expect(await screen.findByText('Explanation for Flagging')).toBeInTheDocument()

      fireEvent.change(screen.getByPlaceholderText('What was wrong?'), { target: { value: 'Rude reply' } })
      fireEvent.click(screen.getByText('No harassment'))
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

      await waitFor(() => expect(sent).not.toBe(null))
      expect(sent).toMatchObject({ postId: '10', commentId: '1', groupId: '3', text: 'Rude reply', platformAgreements: ['5'] })
    })
  })

  describe('handleEditComment', () => {
    it('shows edit form when edit button is clicked', async () => {
      render(<Comment {...props} />, { wrapper: testProviders() })
      fireEvent.click(screen.getByTestId('Edit'))
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      })
    })
  })
})
