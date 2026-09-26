import React from 'react'
import { act, fireEvent } from '@testing-library/react'
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

function commentDraft (data, postId = '1') {
  return {
    id: `draft-${postId}`,
    type: 'comment',
    data,
    groupId: null,
    topicId: null,
    postId,
    messageThreadId: null,
    postType: null,
    isEdit: false,
    navigateTo: '/',
    updatedAt: '2026-09-01T00:00:00.000Z',
    group: null,
    post: { id: postId },
    messageThread: null
  }
}

describe('CommentForm when sending fails', () => {
  it('puts the comment back, re-saves its draft and offers a retry', async () => {
    mockGraphqlServer.use(
      graphql.query('FetchDraft', () => HttpResponse.json({ data: { draft: commentDraft('<p>Hello comment</p>') } }))
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

describe('CommentForm when sending fails after moving to another post', () => {
  it('leaves the other post alone, keeps the comment as its own post\'s draft and retries it there', async () => {
    let firstPostDraft = '<p>Only for the first post</p>'
    const fetchedPostIds = []
    mockGraphqlServer.use(graphql.query('FetchDraft', ({ variables }) => {
      fetchedPostIds.push(String(variables.postId))
      const draft = String(variables.postId) === '1' && firstPostDraft ? commentDraft(firstPostDraft) : null
      return HttpResponse.json({ data: { draft } })
    }))
    saveDraft.mockClear()
    toast.error.mockClear()
    let rejectSend
    const createFirstPostComment = jest.fn(() => new Promise((resolve, reject) => { rejectSend = reject }))
    const createSecondPostComment = jest.fn(() => Promise.resolve())
    const { container, rerender } = render(
      <CommentForm postId='1' createComment={createFirstPostComment} />,
      { wrapper: providersWithUser() }
    )
    const editorText = () => container.querySelector('.ProseMirror')?.textContent

    await waitFor(() => expect(editorText()).toContain('Only for the first post'))
    fireEvent.click(container.querySelector('.lucide-send-horizontal').closest('button'))
    expect(createFirstPostComment).toHaveBeenCalledWith({ text: '<p>Only for the first post</p>', attachments: [] })
    // Sending removed the first post's draft
    firstPostDraft = null

    rerender(<CommentForm postId='2' createComment={createSecondPostComment} />)
    await waitFor(() => expect(fetchedPostIds).toContain('2'))
    await act(async () => { rejectSend(new Error('server error')) })

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Your comment couldn\'t be sent', expect.anything()))
    expect(editorText()).not.toContain('Only for the first post')
    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      type: 'comment',
      postId: '1',
      data: '<p>Only for the first post</p>'
    })))
    expect(saveDraft).not.toHaveBeenCalledWith(expect.objectContaining({ postId: '2' }))

    createFirstPostComment.mockClear()
    createFirstPostComment.mockImplementation(() => Promise.resolve())
    toast.error.mock.calls[0][1].action.onClick()
    expect(createFirstPostComment).toHaveBeenCalledWith({ text: '<p>Only for the first post</p>', attachments: [] })
    expect(createSecondPostComment).not.toHaveBeenCalled()
  })
})
