import { getSocket, sendIsTyping, setSocket } from './websockets.js'

describe('sendIsTyping', () => {
  let realSocket

  const mockSocket = {
    post: jest.fn()
  }

  beforeEach(() => {
    realSocket = getSocket()
    setSocket(mockSocket)
  })

  afterEach(() => {
    setSocket(realSocket)
  })

  it('posts to the correct URL', () => {
    sendIsTyping('42', true)
    const expectedUrl = `${process.env.SOCKET_HOST}/noo/post/42/typing`
    expect(mockSocket.post).toHaveBeenCalledWith(expectedUrl, { isTyping: true })
  })
})
