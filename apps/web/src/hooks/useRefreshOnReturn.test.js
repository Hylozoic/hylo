import { renderHook, act } from '@testing-library/react'
import { getSocket, setSocket } from 'client/websockets'
import useRefreshOnReturn, { REFRESH_ON_RETURN_MIN_AWAY_MS, REFRESH_ON_RETURN_THROTTLE_MS } from './useRefreshOnReturn'

function mockSocket () {
  const handlers = {}
  return {
    on: jest.fn((event, fn) => { (handlers[event] = handlers[event] || []).push(fn) }),
    off: jest.fn((event, fn) => { handlers[event] = (handlers[event] || []).filter(h => h !== fn) }),
    emit: event => (handlers[event] || []).forEach(fn => fn()),
    handlers
  }
}

function setVisibility (state) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useRefreshOnReturn', () => {
  let originalSocket, socket, now

  beforeEach(() => {
    originalSocket = getSocket()
    socket = mockSocket()
    setSocket(socket)
    now = 1000000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    setSocket(originalSocket)
    jest.restoreAllMocks()
    delete document.visibilityState
  })

  const pastThrottle = () => { now += REFRESH_ON_RETURN_THROTTLE_MS + 1 }

  it('ignores triggers right after mounting, since the caller has just fetched', () => {
    const refresh = jest.fn()
    renderHook(() => useRefreshOnReturn(refresh))
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes when the page becomes visible, but not when it is hidden', () => {
    const refresh = jest.fn()
    renderHook(() => useRefreshOnReturn(refresh))
    pastThrottle()
    act(() => setVisibility('hidden'))
    expect(refresh).not.toHaveBeenCalled()
    now += REFRESH_ON_RETURN_MIN_AWAY_MS
    act(() => setVisibility('visible'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('skips a refresh when the page was only left briefly', () => {
    const refresh = jest.fn()
    renderHook(() => useRefreshOnReturn(refresh))
    pastThrottle()
    act(() => { window.dispatchEvent(new Event('blur')) })
    now += REFRESH_ON_RETURN_MIN_AWAY_MS - 1
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(refresh).not.toHaveBeenCalled()

    act(() => setVisibility('hidden'))
    now += REFRESH_ON_RETURN_MIN_AWAY_MS
    act(() => setVisibility('visible'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('still refreshes on a reconnect after a brief absence', () => {
    const refresh = jest.fn()
    renderHook(() => useRefreshOnReturn(refresh))
    pastThrottle()
    act(() => { window.dispatchEvent(new Event('blur')) })
    act(() => socket.emit('connect'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes when the window regains focus', () => {
    const refresh = jest.fn()
    renderHook(() => useRefreshOnReturn(refresh))
    pastThrottle()
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes when the socket reconnects', () => {
    const refresh = jest.fn()
    renderHook(() => useRefreshOnReturn(refresh))
    pastThrottle()
    act(() => socket.emit('connect'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('collapses the signals from a single return into one refresh', () => {
    const refresh = jest.fn()
    renderHook(() => useRefreshOnReturn(refresh))
    pastThrottle()
    act(() => {
      setVisibility('visible')
      window.dispatchEvent(new Event('focus'))
      socket.emit('connect')
      socket.emit('reconnect')
    })
    expect(refresh).toHaveBeenCalledTimes(1)

    pastThrottle()
    act(() => socket.emit('connect'))
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('returns a throttled refreshNow sharing the same window', () => {
    const refresh = jest.fn()
    const { result } = renderHook(() => useRefreshOnReturn(refresh))
    pastThrottle()
    act(() => {
      result.current()
      window.dispatchEvent(new Event('focus'))
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('calls the latest refresh callback', () => {
    const first = jest.fn()
    const second = jest.fn()
    const { rerender } = renderHook(({ refresh }) => useRefreshOnReturn(refresh), { initialProps: { refresh: first } })
    rerender({ refresh: second })
    pastThrottle()
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('does nothing when disabled', () => {
    const refresh = jest.fn()
    const { result } = renderHook(() => useRefreshOnReturn(refresh, { enabled: false }))
    pastThrottle()
    act(() => {
      setVisibility('visible')
      window.dispatchEvent(new Event('focus'))
      socket.emit('connect')
      result.current()
    })
    expect(refresh).not.toHaveBeenCalled()
    expect(socket.on).not.toHaveBeenCalled()
  })

  it('removes its listeners on unmount', () => {
    const refresh = jest.fn()
    const { unmount } = renderHook(() => useRefreshOnReturn(refresh))
    unmount()
    pastThrottle()
    act(() => {
      setVisibility('visible')
      window.dispatchEvent(new Event('focus'))
      socket.emit('connect')
    })
    expect(refresh).not.toHaveBeenCalled()
    expect(socket.handlers.connect).toEqual([])
  })
})
