import React from 'react'
import { fireEvent } from '@testing-library/react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { toast } from 'sonner'
import orm from 'store/models'
import { saveDraft } from 'store/actions/draftActions'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import CommentForm from './CommentForm'

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(() => 'toast-id'),
    dismiss: jest.fn()
  }
}))

jest.mock('store/actions/draftActions', () => ({
  ...jest.requireActual('store/actions/draftActions'),
  saveDraft: jest.fn(() => ({ type: 'TEST_SAVE_DRAFT' }))
}))

function providersWithUser (user = { id: '1', name: 'Jen Smith', avatarUrl: 'foo.png' }) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  if (user) ormSession.Me.create(user)
  return AllTheProviders({ orm: ormSession.state })
}

describe('CommentForm', () => {
  it('renders correctly with current user', () => {
    render(
      <CommentForm postId='new' createComment={jest.fn()} />,
      { wrapper: providersWithUser() }
    )

    expect(screen.getByRole('img').getAttribute('style')).toContain('background-image: url(foo.png)')
    expect(screen.getByTestId('upload-button')).toBeInTheDocument()
  })

  it('renders correctly without current user', () => {
    render(
      <CommentForm postId='new' createComment={jest.fn()} />,
      { wrapper: providersWithUser(null) }
    )

    expect(screen.getByTestId('icon-Person')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign up to reply' })).toBeInTheDocument()
    expect(screen.queryByTestId('upload-button')).not.toBeInTheDocument()
  })
})

describe('CommentForm send button', () => {
  it('explains that text is needed only while there is nothing to send', async () => {
    render(
      <CommentForm postId='1' createComment={jest.fn()} />,
      { wrapper: providersWithUser() }
    )
    fireEvent.focus(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('You need to include text to post a comment')
  })

  it('is simply labelled Send once there is text', async () => {
    render(
      <CommentForm postId='1' createComment={jest.fn()} editorContent='<p>Hi</p>' />,
      { wrapper: providersWithUser() }
    )
    fireEvent.focus(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Send')
    expect(screen.queryByText('You need to include text to post a comment')).not.toBeInTheDocument()
  })
})

describe('CommentForm when sending fails', () => {
  it('puts the comment back, re-saves its draft and offers a retry', async () => {
    mockGraphqlServer.use(
      graphql.query('FetchDraft', () => HttpResponse.json({
        data: {
          draft: {
            id: 'draft-1',
            type: 'comment',
            data: '<p>Hello comment</p>',
            groupId: null,
            topicId: null,
            postId: '1',
            messageThreadId: null,
            postType: null,
            isEdit: false,
            navigateTo: '/',
            updatedAt: '2026-09-01T00:00:00.000Z',
            group: null,
            post: { id: '1' },
            messageThread: null
          }
        }
      }))
    )
    const createComment = jest.fn(() => Promise.reject(new Error('offline')))
    const { container } = render(
      <CommentForm postId='1' createComment={createComment} />,
      { wrapper: providersWithUser() }
    )
    const editorText = () => container.querySelector('.ProseMirror')?.textContent

    await waitFor(() => expect(editorText()).toContain('Hello comment'))
    fireEvent.click(container.querySelector('.lucide-send-horizontal').closest('button'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'Your comment couldn\'t be sent',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Try Again' }) })
    ))
    expect(createComment).toHaveBeenCalledWith({ text: '<p>Hello comment</p>', attachments: [] })
    expect(editorText()).toContain('Hello comment')
    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      type: 'comment',
      data: '<p>Hello comment</p>'
    })))

    createComment.mockClear()
    toast.error.mock.calls[0][1].action.onClick()
    expect(createComment).toHaveBeenCalledWith({ text: '<p>Hello comment</p>', attachments: [] })
  })
})
