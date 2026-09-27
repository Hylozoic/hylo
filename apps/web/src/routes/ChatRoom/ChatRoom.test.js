/* eslint-env jest */
import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import ChatRoom from './ChatRoom'
import { chatRoomPageParams, chatShowsDayLabel, computeChatInitialScrollIndex, isPendingLocalPost, isPersistedChatPostId, samePostId } from './chatRoomUtils'

jest.mock('@virtuoso.dev/message-list', () => ({
  VirtuosoMessageList: () => <div data-testid='virtuoso-message-list' />,
  VirtuosoMessageListLicense: ({ children }) => <div>{children}</div>,
  useCurrentlyRenderedData: () => [],
  useVirtuosoLocation: () => ({ bottomOffset: 0, listOffset: 0 }),
  useVirtuosoMethods: () => ({ scrollToItem: jest.fn() })
}))

jest.mock('client/websockets.js', () => ({
  getSocket: () => ({
    on: jest.fn(),
    off: jest.fn()
  })
}))

const mockChatEditorProps = {}
jest.mock('components/ChatEditor', () => {
  return function MockChatEditor (props) {
    Object.assign(mockChatEditorProps, props)
    return <div data-testid='post-editor' />
  }
})

jest.mock('contexts/ViewHeaderContext', () => ({
  useViewHeader: () => ({
    setHeaderDetails: jest.fn()
  })
}))

function setupTestProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Group.create({
    id: '1',
    name: 'Test Group',
    slug: 'test-group'
  })
  ormSession.Me.create({
    id: '1',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg'
  })

  return AllTheProviders({ orm: ormSession.state })
}

describe('ChatRoom', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ChatRoom groupSlug='test-group' />,
      null,
      setupTestProviders()
    )
    expect(container.querySelector('#root') || container).toBeTruthy()
  })

  it('lets the composer withdraw a message that failed to send', () => {
    render(
      <ChatRoom groupSlug='test-group' />,
      null,
      setupTestProviders()
    )
    expect(screen.getByTestId('post-editor')).toBeInTheDocument()
    expect(mockChatEditorProps.onSaveFailed).toEqual(expect.any(Function))
  })
})

describe('chatShowsDayLabel', () => {
  it('hides the day bar on the first loaded row while older posts can still load', () => {
    expect(chatShowsDayLabel({ prevCreatedAt: null, sameDayAsPrevious: false, hasMorePast: true })).toBe(false)
  })

  it('shows the day bar at the start of history or when the day changes', () => {
    expect(chatShowsDayLabel({ prevCreatedAt: null, sameDayAsPrevious: false, hasMorePast: false })).toBe(true)
    expect(chatShowsDayLabel({ prevCreatedAt: '2026-09-01', sameDayAsPrevious: false, hasMorePast: true })).toBe(true)
    expect(chatShowsDayLabel({ prevCreatedAt: '2026-09-02', sameDayAsPrevious: true, hasMorePast: true })).toBe(false)
  })
})

describe('isPersistedChatPostId', () => {
  it('rejects pending, missing, and sentinel ids that cannot be last-read', () => {
    expect(isPersistedChatPostId({ id: '108579' })).toBe(true)
    expect(isPersistedChatPostId({ id: '108579', pending: true })).toBe(false)
    expect(isPersistedChatPostId({ localId: 'post_1', pending: true })).toBe(false)
    expect(isPersistedChatPostId({ id: String(Number.MAX_SAFE_INTEGER) })).toBe(false)
    expect(isPersistedChatPostId({ id: 'post_1' })).toBe(false)
  })
})

describe('isPendingLocalPost', () => {
  it('matches only the unsent optimistic message for a failed send', () => {
    expect(isPendingLocalPost({ localId: 'post_3', pending: true }, 'post_3')).toBe(true)
    expect(isPendingLocalPost({ localId: 'post_3', id: '108579' }, 'post_3')).toBe(false)
    expect(isPendingLocalPost({ localId: 'post_4', pending: true }, 'post_3')).toBe(false)
    expect(isPendingLocalPost({ pending: true }, undefined)).toBe(false)
  })
})

describe('samePostId', () => {
  it('treats string and number ids as the same post', () => {
    expect(samePostId('108579', 108579)).toBe(true)
    expect(samePostId('108579', '108578')).toBe(false)
  })
})

describe('chatRoomPageParams', () => {
  const base = { slug: 'room', filter: 'chat', sortBy: 'id' }

  it('loads a full future page after lastRead, not sized by unread count', () => {
    expect(chatRoomPageParams(base, { startId: '108578', order: 'asc', first: 25 })).toEqual({
      ...base,
      cursor: '108578',
      first: 25,
      order: 'asc'
    })
  })

  it('loads latest past posts when lastRead is missing instead of a NaN cursor', () => {
    const past = chatRoomPageParams(base, { startId: undefined, order: 'desc', first: 25 })
    expect(past.cursor).toBeUndefined()
    expect(past.order).toBe('desc')
    expect(chatRoomPageParams(base, { startId: undefined, order: 'asc', first: 25 }).cursor)
      .toBe(String(Number.MAX_SAFE_INTEGER))
  })
})

describe('computeChatInitialScrollIndex', () => {
  const posts = [{ id: '10' }, { id: '11' }, { id: '12' }, { id: '13' }]

  it('lands on the last-read post so one past post sits above New posts', () => {
    expect(computeChatInitialScrollIndex(posts, null, '11')).toBe(1)
  })

  it('does not jump to the newest post when lastRead is in the window', () => {
    expect(computeChatInitialScrollIndex(posts, null, '11')).not.toBe(3)
  })
})
