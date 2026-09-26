/* eslint-env jest */
import React from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { generateStore } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import { SpaceGroupSlugContext } from 'contexts/SpaceGroupContext'
import {
  CHAT_ID_FOR_NEW,
  ID_FOR_NEW,
  addAttachment,
  getAttachments
} from 'components/AttachmentManager/AttachmentManager.store'
import createPost from 'store/actions/createPost'
import { saveDraft } from 'store/actions/draftActions'
import { toast } from 'sonner'
import ChatEditor from './ChatEditor'

jest.mock('client/websockets', () => ({
  sendIsTypingGroup: jest.fn()
}))

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(() => 'toast-id'),
    dismiss: jest.fn()
  }
}))

jest.mock('store/actions/createPost', () => jest.fn())

jest.mock('store/actions/draftActions', () => ({
  ...jest.requireActual('store/actions/draftActions'),
  saveDraft: jest.fn(() => ({ type: 'TEST_SAVE_DRAFT' }))
}))

function setupStore () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1', name: 'Test User' })
  ormSession.Group.create({ id: '1', name: 'Test Group', slug: 'test-group' })
  return generateStore({ orm: ormSession.state })
}

function renderChatEditor (store, props = {}, ref) {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <SpaceGroupSlugContext.Provider value='test-group'>
          <ChatEditor autoFocus={false} {...props} ref={ref} />
        </SpaceGroupSlugContext.Provider>
      </MemoryRouter>
    </Provider>
  )
}

function chatDraftResponse (draftData) {
  return graphql.query('FetchDraft', () => HttpResponse.json({
    data: {
      draft: {
        id: 'draft-1',
        type: 'post',
        data: JSON.stringify(draftData),
        groupId: '1',
        topicId: null,
        postId: null,
        messageThreadId: null,
        postType: 'chat',
        isEdit: false,
        navigateTo: '/',
        updatedAt: '2026-09-01T00:00:00.000Z',
        group: { id: '1', name: 'Test Group', slug: 'test-group' },
        post: null,
        messageThread: null
      }
    }
  }))
}

describe('ChatEditor attachments', () => {
  it('neither shows nor clears the attachments of a post being written elsewhere', async () => {
    const store = setupStore()
    const postImage = { url: 'https://example.com/post.png', attachmentType: 'image' }
    const { unmount } = renderChatEditor(store)

    act(() => { store.dispatch(addAttachment('post', ID_FOR_NEW, postImage)) })
    expect(screen.queryByText('Images')).not.toBeInTheDocument()

    unmount()
    expect(getAttachments(store.getState(), { type: 'post', id: ID_FOR_NEW, attachmentType: 'image' })).toEqual([postImage])
  })

  it('restores attachments from the room\'s draft into its own bucket', async () => {
    mockGraphqlServer.use(chatDraftResponse({
      details: '<p>Look at this</p>',
      type: 'chat',
      imageUrls: ['https://example.com/chat.png'],
      fileUrls: []
    }))
    const store = setupStore()
    renderChatEditor(store)

    await screen.findByText('Images')
    await waitFor(() => {
      expect(getAttachments(store.getState(), { type: 'post', id: CHAT_ID_FOR_NEW, attachmentType: 'image' }))
        .toEqual([{ url: 'https://example.com/chat.png', attachmentType: 'image' }])
    })
    expect(getAttachments(store.getState(), { type: 'post', id: ID_FOR_NEW, attachmentType: 'image' })).toEqual([])
  })
})

describe('ChatEditor when sending fails', () => {
  it('withdraws the optimistic message, puts the text back, re-saves the draft and offers a retry', async () => {
    mockGraphqlServer.use(chatDraftResponse({ details: '<p>Hello there</p>', type: 'chat' }))
    createPost.mockImplementation(() => ({ type: 'TEST_CREATE_POST_FAILED', payload: Promise.reject(new Error('offline')) }))
    saveDraft.mockClear()
    const onSave = jest.fn()
    const onSaveFailed = jest.fn()
    const afterSave = jest.fn()
    const editorRef = React.createRef()
    const store = setupStore()
    const { container } = renderChatEditor(store, { onSave, onSaveFailed, afterSave }, editorRef)
    const editorText = () => container.querySelector('.ProseMirror')?.textContent

    await waitFor(() => expect(editorText()).toContain('Hello there'))

    await act(async () => { await editorRef.current.submit() })

    expect(onSave).toHaveBeenCalledTimes(1)
    const { localId } = onSave.mock.calls[0][0]
    expect(onSaveFailed).toHaveBeenCalledWith(localId)
    expect(afterSave).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      'Your message couldn\'t be sent',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Try Again' }) })
    )
    await waitFor(() => expect(editorText()).toContain('Hello there'))
    await waitFor(() => {
      expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ data: expect.stringContaining('Hello there') }))
    }, { timeout: 4000 })

    createPost.mockClear()
    const retry = toast.error.mock.calls[0][1].action.onClick
    await act(async () => { retry() })
    await waitFor(() => expect(createPost).toHaveBeenCalledWith(expect.objectContaining({ details: '<p>Hello there</p>' })))
  }, 20000)

  it.each([
    ['only an attachment', ''],
    ['text and an attachment', '<p>Look at this</p>']
  ])('puts a message with %s back, attachment included, and re-saves the draft', async (_, details) => {
    const imageUrl = 'https://example.com/chat.png'
    mockGraphqlServer.use(chatDraftResponse({ details, type: 'chat', imageUrls: [imageUrl], fileUrls: [] }))
    createPost.mockImplementation(() => ({ type: 'TEST_CREATE_POST_FAILED', payload: Promise.reject(new Error('offline')) }))
    saveDraft.mockClear()
    toast.error.mockClear()
    const onSaveFailed = jest.fn()
    const editorRef = React.createRef()
    const store = setupStore()
    const { container } = renderChatEditor(store, { onSave: jest.fn(), onSaveFailed }, editorRef)
    const chatImages = () => getAttachments(store.getState(), { type: 'post', id: CHAT_ID_FOR_NEW, attachmentType: 'image' })
    const editorText = () => container.querySelector('.ProseMirror')?.textContent

    await waitFor(() => expect(chatImages()).toEqual([{ url: imageUrl, attachmentType: 'image' }]))

    await act(async () => { await editorRef.current.submit() })

    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({ imageUrls: [imageUrl] }))
    expect(onSaveFailed).toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Your message couldn\'t be sent', expect.anything())
    await waitFor(() => expect(chatImages()).toEqual([{ url: imageUrl, attachmentType: 'image' }]))
    if (details) expect(editorText()).toContain('Look at this')
    await waitFor(() => {
      expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ data: expect.stringContaining(imageUrl) }))
    }, { timeout: 4000 })
  }, 20000)
})
