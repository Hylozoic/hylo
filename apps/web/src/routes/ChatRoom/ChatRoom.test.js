/* eslint-env jest */
import React from 'react'
import { render, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import ChatRoom from './ChatRoom'

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

jest.mock('components/ChatEditor', () => {
  return function MockChatEditor () {
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
})
