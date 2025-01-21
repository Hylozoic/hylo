import { getSocket, clearSingletons } from './websockets'
import { setSessionCookie } from 'util/session'
import { times } from 'lodash'

const mockStorage = {}

jest.mock('react-native', () => ({
  AsyncStorage: {
    setItem: (key, value) => {
      mockStorage[key] = value
      return Promise.resolve()
    },
    getItem: key => Promise.resolve(mockStorage[key]),
    Platform: { OS: 'ios' }
  },
  Platform: { OS: 'ios' },
  NativeModules: {
    RNDeviceInfo: {}
  }
}))

jest.mock('sails.io.js', () => {
  return (socketConstructor) => ({
    sails: {
      connect: host => socketConstructor(host, { autoConnect: false })
    }
  })
})

const mockHeaders = {
  'set-cookie': 'foo=bar'
}

const mockResp = {
  headers: {
    get: key => mockHeaders[key]
  }
}

let singletonSocket

it('throws an error without a session cookie', () => {
  expect.assertions(1)
  return getSocket()
    .catch(err => expect(err.message).toMatch(/must have a session cookie/))
})

it('uses the session cookie', () => {
  clearSingletons()
  return setSessionCookie(mockResp)
    .then(() => getSocket())
    .then(socket => {
      expect(socket).toBeTruthy()
      singletonSocket = socket
      socket.__originalRequest = jest.fn()
      const callback = () => {}
      socket.request({}, callback)
      expect(socket.__originalRequest)
        .toBeCalledWith({ headers: { cookie: 'foo=bar' } }, callback)
    })
})

it('returns the singleton', () => {
  return getSocket()
    .then(socket => expect(socket).toEqual(singletonSocket))
})

it('uses a singleton promise to avoid race conditions', () => {
  clearSingletons()
  expect.assertions(19)
  return setSessionCookie(mockResp)
    .then(() => Promise.all(times(20, () => getSocket())))
    .then(sockets => {
      const socket = sockets[0]
      for (let i = 1; i < sockets.length; i++) {
        expect(socket).toEqual(sockets[i])
      }
    })
})
