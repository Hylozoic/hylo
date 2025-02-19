import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import SocketListener from './SocketListener'
import { getSocket, setSocket } from 'client/websockets'

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
    `${process.env.SOCKET_HOST}/noo/user/subscribe`,
    expect.any(Function)
  )
})

it.skip('unsubscribes and removes event handlers on unmount', () => {
  const { unmount } = render(<SocketListener />)

  unmount()

  expect(mockSocket.post).toHaveBeenCalledWith(
    `${process.env.SOCKET_HOST}/noo/user/unsubscribe`
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
