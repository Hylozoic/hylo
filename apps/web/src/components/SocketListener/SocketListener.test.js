import React from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import orm from 'store/models'
import { AllTheProviders, act, render } from 'util/testing/reactTestingLibraryExtended'
import SocketListener from './SocketListener'
import { getSocket, setSocket } from 'client/websockets'
import { refreshBadgeCounts } from 'util/badgeRefresh'

jest.mock('util/badgeRefresh', () => ({
  refreshBadgeCounts: jest.fn()
}))

jest.mock('sonner', () => ({
  ...jest.requireActual('sonner'),
  toast: jest.fn()
}))

let realSocket, mockSocket, listens

beforeEach(() => {
  realSocket = getSocket()
  listens = []
  mockSocket = {
    post: jest.fn(),
    listens: [],
    on: jest.fn(function () {
      listens.push(Array.prototype.slice.call(arguments))
    })
  }
  setSocket(mockSocket)
})

afterEach(() => {
  setSocket(realSocket)
})

it.skip('sets up event handlers and subscribes', () => {
  const mockHandlers = {
    receiveComment: jest.fn(),
    receiveMessage: jest.fn(),
    receiveNotification: jest.fn(),
    receivePost: jest.fn(),
    receiveThread: jest.fn(),
    addUserTyping: jest.fn(),
    clearUserTyping: jest.fn()
  }

  render(<SocketListener {...mockHandlers} />)

  // Check if all event handlers are set up
  const expectedHandlers = [
    'commentAdded',
    'messageAdded',
    'newNotification',
    'newPost',
    'newThread',
    'userTyping'
  ]

  expectedHandlers.forEach(handlerName => {
    const listen = listens.find(x => x[0] === handlerName)
    expect(listen).toBeTruthy()
    expect(typeof listen[1]).toEqual('function')
  })

  // Check if the component subscribes to the socket
  expect(mockSocket.post).toHaveBeenCalledWith(
    `${process.env.VITE_SOCKET_HOST}/noo/user/subscribe`,
    expect.any(Function)
  )
})

it.skip('unsubscribes and removes event handlers on unmount', () => {
  const { unmount } = render(<SocketListener />)

  unmount()

  expect(mockSocket.post).toHaveBeenCalledWith(
    `${process.env.VITE_SOCKET_HOST}/noo/user/unsubscribe`
  )

  // Check if all event handlers are removed
  const expectedHandlers = [
    'commentAdded',
    'messageAdded',
    'newNotification',
    'newPost',
    'newThread',
    'userTyping'
  ]

  expectedHandlers.forEach(handlerName => {
    expect(mockSocket.off).toHaveBeenCalledWith(handlerName, expect.any(Function))
  })
})

// Add more specific tests as needed

describe('on socket reconnect', () => {
  let handlersByEvent

  beforeEach(() => {
    handlersByEvent = {}
    setSocket({
      post: jest.fn(),
      on: jest.fn((event, handler) => { handlersByEvent[event] = handler }),
      off: jest.fn()
    })
    refreshBadgeCounts.mockClear()
  })

  it('refetches the badge counts that pushes would have updated', () => {
    render(<SocketListener />)

    handlersByEvent.reconnect()

    expect(refreshBadgeCounts).toHaveBeenCalledTimes(1)
    expect(getSocket().post).toHaveBeenCalledWith(expect.stringContaining('/noo/user/subscribe'), expect.any(Function))
  })

  it('does not refetch on the first connect', () => {
    render(<SocketListener />)

    handlersByEvent.connect()

    expect(refreshBadgeCounts).not.toHaveBeenCalled()
  })
})

describe('toasts for direct notifications and messages', () => {
  let handlersByEvent

  // useLocation is mocked for every test (config/jest/beforeTestEnvSetup.js)
  const providers = pathname => {
    useLocation.mockReturnValue({ pathname, search: '' })
    const session = orm.mutableSession(orm.getEmptyState())
    session.Me.create({ id: '1', newNotificationCount: 0, unseenThreadCount: 0 })
    session.Person.create({ id: '3', name: 'Sam' })
    return AllTheProviders({ orm: session.state })
  }

  const notification = action => ({
    id: '99',
    activity: {
      id: '12',
      action,
      actor: { id: '3', name: 'Sam', avatarUrl: null },
      post: { id: '5', title: 'Garden day', details: '', topics: [] },
      group: { id: '2', name: 'Garden', slug: 'garden' },
      meta: { reasons: [action] }
    }
  })

  // The shape the server sends (see pushMessageToSockets)
  const message = threadId => ({
    id: '40',
    createdAt: new Date().toString(),
    creator: '3',
    messageThread: threadId,
    text: 'Are you coming?',
    attachments: [],
    isMuted: false
  })

  afterEach(() => {
    useLocation.mockReturnValue({ pathname: '', search: '' })
  })

  beforeEach(() => {
    handlersByEvent = {}
    toast.mockClear()
    setSocket({
      post: jest.fn(),
      on: jest.fn((event, handler) => { handlersByEvent[event] = handler }),
      off: jest.fn()
    })
  })

  it('shows a toast for a mention', () => {
    render(<SocketListener />, {}, providers('/groups/garden/stream'))
    act(() => handlersByEvent.newNotification(notification('mention')))
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('only counts an ambient notification', () => {
    render(<SocketListener />, {}, providers('/groups/garden/stream'))
    act(() => handlersByEvent.newNotification(notification('newPost')))
    expect(toast).not.toHaveBeenCalled()
  })

  it('does not toast a mention on the page it points to', () => {
    render(<SocketListener />, {}, providers('/groups/garden/post/5'))
    act(() => handlersByEvent.newNotification(notification('mention')))
    expect(toast).not.toHaveBeenCalled()
  })

  it('toasts a direct message in a thread the viewer is not reading', () => {
    render(<SocketListener />, {}, providers('/groups/garden/stream'))
    act(() => handlersByEvent.messageAdded(message('7')))
    expect(toast).toHaveBeenCalledWith('Sam sent you a message', expect.anything())
  })

  it('does not toast a direct message in the open thread', () => {
    render(<SocketListener />, {}, providers('/messages/7'))
    act(() => handlersByEvent.messageAdded(message('7')))
    expect(toast).not.toHaveBeenCalled()
  })
})
