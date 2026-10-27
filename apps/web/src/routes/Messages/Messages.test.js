import React from 'react'
import { useNavigate } from 'react-router-dom'
import { render, AllTheProviders, act, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import Messages from './Messages'

let mockMessageThreadId = '1'
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ messageThreadId: mockMessageThreadId })
}))

jest.mock('util/mobile', () => ({
  ...jest.requireActual('util/mobile'),
  isPhoneDevice: () => false,
  isMobileDevice: () => false
}))

describe('Messages component', () => {
  let threadQueryCount

  beforeEach(() => {
    mockMessageThreadId = '1'
    threadQueryCount = 0
    mockGraphqlServer.use(
      graphql.query('MessageThreadsQuery', () => {
        return HttpResponse.json({
          data: {
            me: {
              id: '1',
              messageThreads: {
                items: [{
                  id: '1',
                  unreadCount: 0,
                  lastReadAt: null,
                  createdAt: null,
                  updatedAt: null,
                  participants: [],
                  messages: { items: [] }
                }]
              }
            }
          }
        })
      }),
      graphql.query('MessageThreadQuery', () => {
        threadQueryCount += 1
        return HttpResponse.json({
          data: {
            messageThread: {
              id: '1',
              unreadCount: 0,
              lastReadAt: null,
              createdAt: null,
              updatedAt: null,
              participants: [],
              messages: { items: [] }
            }
          }
        })
      }),
      graphql.query('PeopleQuery', () => {
        return HttpResponse.json({
          data: {
            groups: {
              items: [{
                id: '1',
                members: { items: [{ id: '1', name: 'John Doe', avatarUrl: 'https://example.com/avatar.jpg' }] }
              }]
            }
          }
        })
      })
    )
  })

  it('renders without crashing', async () => {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Me.create({ id: '1', name: 'Test User' })

    const { container } = render(
      <Messages />,
      null,
      AllTheProviders({ orm: ormSession.state })
    )

    expect(container.querySelector('#root') || container).toBeTruthy()
    // let the thread fetch settle so it isn't counted by a later test
    await waitFor(() => expect(threadQueryCount).toBe(1))
  })

  describe('refreshing the open thread', () => {
    // Move the clock past the refresh throttle without faking timers (msw needs real ones)
    let clockOffset
    beforeEach(() => {
      clockOffset = 0
      const realNow = Date.now.bind(Date)
      jest.spyOn(Date, 'now').mockImplementation(() => realNow() + clockOffset)
    })
    afterEach(() => {
      jest.restoreAllMocks()
      delete document.visibilityState
    })
    const pastThrottle = () => { clockOffset += 5000 }
    const returnToApp = () => act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })

    function renderMessages (path, extra = null) {
      const ormSession = orm.mutableSession(orm.getEmptyState())
      ormSession.Me.create({ id: '1', name: 'Test User' })
      return render(
        <><Messages />{extra}</>,
        null,
        AllTheProviders({ orm: ormSession.state }, [path])
      )
    }

    it('refetches the thread once when the app returns to the foreground', async () => {
      renderMessages('/messages/1')
      await waitFor(() => expect(threadQueryCount).toBe(1))

      pastThrottle()
      returnToApp()
      await waitFor(() => expect(threadQueryCount).toBe(2))
      // visibilitychange + focus from the same return must not fetch twice
      await act(() => new Promise(resolve => setTimeout(resolve, 50)))
      expect(threadQueryCount).toBe(2)
    })

    it('refetches the thread when navigating to the thread that is already open', async () => {
      let navigate
      const GrabNavigate = () => { navigate = useNavigate(); return null }
      renderMessages('/messages/1', <GrabNavigate />)
      await waitFor(() => expect(threadQueryCount).toBe(1))

      pastThrottle()
      act(() => navigate('/messages/1'))
      await waitFor(() => expect(threadQueryCount).toBe(2))
    })

    it('does not fetch a thread for the new-message composer', async () => {
      mockMessageThreadId = 'new'
      renderMessages('/messages/new')
      pastThrottle()
      returnToApp()
      // give any (unexpected) request time to land
      await act(() => new Promise(resolve => setTimeout(resolve, 50)))
      expect(threadQueryCount).toBe(0)
    })
  })
})
