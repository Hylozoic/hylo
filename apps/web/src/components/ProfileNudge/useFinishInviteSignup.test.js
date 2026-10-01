import { renderHook, waitFor } from '@testing-library/react'
import { AnalyticsEvents } from '@hylo/shared'
import useFinishInviteSignup from './useFinishInviteSignup'

const mockDispatch = jest.fn()
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useDispatch: () => mockDispatch }))
jest.mock('store/actions/trackAnalyticsEvent', () => (eventName, data) => ({ type: 'TRACK', eventName, data }))
jest.mock('store/actions/updateUserSettings', () => changes => ({ type: 'UPDATE_SETTINGS', changes }))

// The server's answer to finishing signup: an action, or a rejection
function serverAnswers (answer) {
  mockDispatch.mockImplementation(action => action.type === 'UPDATE_SETTINGS' ? answer() : action)
}

const tracked = () => mockDispatch.mock.calls.map(([action]) => action).filter(action => action.type === 'TRACK')

describe('useFinishInviteSignup', () => {
  beforeEach(() => mockDispatch.mockReset())

  it('records the skipped photo and location steps, and the finished signup, once the server confirms', async () => {
    serverAnswers(() => Promise.resolve({ type: 'UPDATE_SETTINGS' }))
    const { result } = renderHook(() => useFinishInviteSignup(true))

    await waitFor(() => expect(result.current.finished).toBe(true))
    expect(result.current.finishing).toBe(false)
    expect(tracked()).toEqual([
      { type: 'TRACK', eventName: AnalyticsEvents.WELCOME_WIZARD_STEP_SKIPPED, data: { step: 'upload-photo', reason: 'invite' } },
      { type: 'TRACK', eventName: AnalyticsEvents.WELCOME_WIZARD_STEP_SKIPPED, data: { step: 'add-location', reason: 'invite' } },
      { type: 'TRACK', eventName: AnalyticsEvents.SIGNUP_COMPLETE, data: undefined }
    ])
  })

  it('records no skipped steps when the update fails, as the person then goes through the wizard', async () => {
    serverAnswers(() => Promise.reject(new Error('offline')))
    const { result } = renderHook(() => useFinishInviteSignup(true))

    await waitFor(() => expect(result.current.finishing).toBe(false))
    expect(result.current.finished).toBe(false)
    expect(tracked()).toEqual([])
  })

  it('does nothing for a signup that did not start from an invitation', async () => {
    const { result } = renderHook(() => useFinishInviteSignup(false))
    expect(result.current.finishing).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
