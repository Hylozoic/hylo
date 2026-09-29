/* eslint-env jest */
import React from 'react'
import { Provider } from 'react-redux'
import { act, renderHook, waitFor } from '@testing-library/react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { generateStore } from 'util/testing/reactTestingLibraryExtended'
import { saveDraft } from 'store/actions/draftActions'
import useDraft, { keepAsDraftUnlessPresent } from './useDraft'

jest.mock('store/actions/draftActions', () => ({
  ...jest.requireActual('store/actions/draftActions'),
  saveDraft: jest.fn(() => ({ type: 'TEST_SAVE_DRAFT' }))
}))

beforeEach(() => saveDraft.mockClear())

describe('useDraft', () => {
  it('saves a pending draft under the context it was written in, even after the composer moves on', async () => {
    const store = generateStore()
    const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>
    const { result, rerender } = renderHook(
      ({ groupId }) => useDraft({ type: 'post', groupId, postType: 'chat', navigateTo: `/groups/${groupId}/chat`, debounceMs: 50 }),
      { wrapper, initialProps: { groupId: '1' } }
    )

    act(() => { result.current.saveDraft(JSON.stringify({ details: '<p>For the first room</p>', type: 'chat' })) })
    rerender({ groupId: '2' })

    await waitFor(() => expect(saveDraft).toHaveBeenCalled())
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      groupId: '1',
      navigateTo: '/groups/1/chat',
      data: expect.stringContaining('For the first room')
    }))
    expect(saveDraft).not.toHaveBeenCalledWith(expect.objectContaining({ groupId: '2' }))
  })
})

describe('useDraft drafts that could not reach the server', () => {
  const store = generateStore()
  const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>
  const composer = groupId => renderHook(() => useDraft({ type: 'post', groupId, postType: 'discussion' }), { wrapper })
  const unsent = JSON.stringify({ title: 'Unsent' })

  afterEach(() => saveDraft.mockImplementation(() => ({ type: 'TEST_SAVE_DRAFT' })))

  it('says when a draft could not be saved, and hands a held one to the next composer in the same place', async () => {
    saveDraft.mockImplementation(() => ({ type: 'TEST_SAVE_DRAFT', payload: Promise.reject(new Error('offline')) }))
    const failed = composer('3')
    let saved
    await act(async () => { saved = await failed.result.current.flushSaveDraft(unsent, { force: true }) })
    expect(saved).toBe(false)
    act(() => { failed.result.current.holdUnsentDraft(unsent) })
    failed.unmount()

    expect(composer('4').result.current.takeUnsentDraft()).toBeNull()
    const reopened = composer('3')
    expect(reopened.result.current.takeUnsentDraft()).toBe(unsent)
    expect(reopened.result.current.takeUnsentDraft()).toBeNull()
  })

  it('lets a held draft go once the draft for that place is saved', async () => {
    const held = composer('5')
    act(() => { held.result.current.holdUnsentDraft(unsent) })
    saveDraft.mockImplementation(({ data }) => ({ type: 'TEST_SAVE_DRAFT', payload: { data: { saveDraft: { id: 'draft-5', data } } } }))
    let saved
    await act(async () => { saved = await held.result.current.flushSaveDraft(unsent, { force: true }) })
    expect(saved).toBe(true)
    expect(held.result.current.takeUnsentDraft()).toBeNull()
  })
})

describe('keepAsDraftUnlessPresent', () => {
  const context = { type: 'comment', postId: '7', navigateTo: '/post/7' }

  it('saves the content as the draft when there is none', async () => {
    const store = generateStore()
    await keepAsDraftUnlessPresent(store.dispatch, context, '<p>Unsent</p>')
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      type: 'comment',
      postId: '7',
      navigateTo: '/post/7',
      data: '<p>Unsent</p>'
    }))
  })

  it('leaves an existing draft alone', async () => {
    mockGraphqlServer.use(graphql.query('FetchDraft', () => HttpResponse.json({
      data: {
        draft: {
          id: 'draft-7',
          type: 'comment',
          data: '<p>Newer</p>',
          groupId: null,
          topicId: null,
          postId: '7',
          messageThreadId: null,
          postType: null,
          isEdit: false,
          navigateTo: '/post/7',
          updatedAt: '2026-09-01T00:00:00.000Z',
          group: null,
          post: { id: '7' },
          messageThread: null
        }
      }
    })))
    const store = generateStore()
    await keepAsDraftUnlessPresent(store.dispatch, context, '<p>Unsent</p>')
    expect(saveDraft).not.toHaveBeenCalled()
  })
})
