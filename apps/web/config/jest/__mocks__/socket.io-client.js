import { SocketIO } from 'mock-socket'

export default (...args) => {
  const socket = SocketIO(...args)
  socket.once = socket.on
  socket.io = {
    engine: {
      transport: {
        on: () => {}
      }
    }
  }
  Object.defineProperty(socket, 'connected', {
    get: () => socket.readyState === 1
  })
  return socket
}
