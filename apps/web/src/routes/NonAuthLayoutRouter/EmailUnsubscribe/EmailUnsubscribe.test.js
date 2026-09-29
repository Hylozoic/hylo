import React from 'react'
import { useLocation } from 'react-router-dom'
import orm from 'store/models'
import { AllTheProviders, render, screen, waitFor, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import EmailUnsubscribe from './EmailUnsubscribe'

const mockApiCalls = []
let mockDescribe
let mockConfirm

jest.mock('store/middleware/apiMiddleware', () => (req) => {
  return store => next => action => {
    if (!action.payload?.api) return next(action)
    const api = action.payload.api
    mockApiCalls.push(api)
    const answer = api.method === 'POST' ? mockConfirm : mockDescribe
    return answer instanceof Error
      ? Promise.reject(answer)
      : Promise.resolve({ ...action, payload: answer })
  }
})

const httpError = status => Object.assign(new Error('failed'), { response: { status } })

function renderAt (path) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  return render(<EmailUnsubscribe />, { wrapper: AllTheProviders({ orm: ormSession.state }, [path]) })
}

const posts = () => mockApiCalls.filter(call => call.method === 'POST')

describe('EmailUnsubscribe', () => {
  // The jest setup stubs useLocation; this page reads the token from the real location
  beforeAll(() => {
    useLocation.mockImplementation(jest.requireActual('react-router-dom').useLocation)
  })

  afterAll(() => {
    useLocation.mockReturnValue({ pathname: '', search: '' })
  })

  beforeEach(() => {
    mockApiCalls.length = 0
    mockDescribe = { descriptor: 'group_digest', groupName: 'Orchard', frequency: null, done: false }
    mockConfirm = { success: true, descriptor: 'group_digest', applied: true }
  })

  it('asks first, and changes nothing until the button is pressed', async () => {
    renderAt('/email/unsubscribe?token=abc.def.ghi')

    expect(await screen.findByText('Stop the email digest from Orchard?')).toBeInTheDocument()
    expect(screen.getByText('Its hourly chat digests stop too. Everything is still waiting for you in Hylo.')).toBeInTheDocument()
    expect(mockApiCalls).toEqual([{ path: '/noo/email/unsubscribe/describe', method: 'GET', params: { token: 'abc.def.ghi' } }])
    expect(posts()).toHaveLength(0)
  })

  it('unsubscribes when the button is pressed', async () => {
    renderAt('/email/unsubscribe?token=abc.def.ghi')

    fireEvent.click(await screen.findByTestId('confirm-unsubscribe'))

    // Still the page's heading, inside a status region that announces it
    const heading = await screen.findByRole('heading', { name: "You're unsubscribed." })
    expect(screen.getByRole('status')).toContainElement(heading)
    expect(posts()).toEqual([{ path: '/noo/email/unsubscribe', method: 'POST', params: { token: 'abc.def.ghi' } }])
    expect(screen.getByTestId('notification-settings-link')).toHaveAttribute('href', '/my/notifications')
  })

  it('names the unified digest by its frequency', async () => {
    mockDescribe = { descriptor: 'group_digest', groupName: null, frequency: 'weekly', done: false }
    renderAt('/email/unsubscribe?token=abc')

    expect(await screen.findByText('Stop your weekly Hylo digest?')).toBeInTheDocument()
  })

  it('says so when the email is already stopped, with no button', async () => {
    mockDescribe = { ...mockDescribe, done: true }
    renderAt('/email/unsubscribe?token=abc')

    expect(await screen.findByText("You're unsubscribed.")).toBeInTheDocument()
    expect(screen.queryByTestId('confirm-unsubscribe')).not.toBeInTheDocument()
  })

  it('points email with no single switch to the settings page', async () => {
    mockDescribe = { descriptor: 'settings_page', groupName: null, frequency: null, done: false }
    renderAt('/email/unsubscribe?token=abc')

    expect(await screen.findByText('Choose which emails you get')).toBeInTheDocument()
    expect(screen.queryByTestId('confirm-unsubscribe')).not.toBeInTheDocument()
    expect(screen.getByTestId('notification-settings-link')).toBeInTheDocument()
  })

  it('explains an expired or invalid link', async () => {
    mockDescribe = httpError(400)
    renderAt('/email/unsubscribe?token=abc')

    expect(await screen.findByText("This unsubscribe link has expired or isn't valid.")).toBeInTheDocument()
  })

  it('needs no request when the link has no token', async () => {
    renderAt('/email/unsubscribe')

    expect(await screen.findByText("This unsubscribe link has expired or isn't valid.")).toBeInTheDocument()
    expect(mockApiCalls).toHaveLength(0)
  })

  it('lets the person try again when unsubscribing fails', async () => {
    mockConfirm = httpError(500)
    renderAt('/email/unsubscribe?token=abc')

    fireEvent.click(await screen.findByTestId('confirm-unsubscribe'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    })
    expect(screen.getByTestId('confirm-unsubscribe')).toBeInTheDocument()
  })
})
