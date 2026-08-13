import resolveSocketHost from './resolveSocketHost.js'

describe('resolveSocketHost', () => {
  const envHost = import.meta.env.VITE_SOCKET_HOST

  it('uses VITE_SOCKET_HOST on hylo.com', () => {
    expect(resolveSocketHost()).toBe(envHost)
  })
})
