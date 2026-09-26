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
import ChatEditor from './ChatEditor'

jest.mock('client/websockets', () => ({
  sendIsTypingGroup: jest.fn()
}))

function setupStore () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1', name: 'Test User' })
  ormSession.Group.create({ id: '1', name: 'Test Group', slug: 'test-group' })
  return generateStore({ orm: ormSession.state })
}

function renderChatEditor (store, props = {}) {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <SpaceGroupSlugContext.Provider value='test-group'>
          <ChatEditor autoFocus={false} {...props} />
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
