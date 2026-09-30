import { browserTimezone, syncTimezone } from './timezone'
import { UPDATE_USER_SETTINGS } from 'store/constants'

describe('timezone capture (D41)', () => {
  const realDateTimeFormat = Intl.DateTimeFormat

  const withBrowserTimezone = timeZone => {
    Intl.DateTimeFormat = jest.fn(() => ({ resolvedOptions: () => ({ timeZone }) }))
  }

  afterEach(() => {
    Intl.DateTimeFormat = realDateTimeFormat
  })

  it("reads the browser's IANA timezone", () => {
    withBrowserTimezone('Europe/Berlin')
    expect(browserTimezone()).toBe('Europe/Berlin')
    withBrowserTimezone(undefined)
    expect(browserTimezone()).toBeNull()
  })

  it('saves the timezone when the account has none', async () => {
    withBrowserTimezone('Asia/Kolkata')
    const dispatch = jest.fn(action => Promise.resolve(action))
    await syncTimezone(dispatch, { id: '1', settings: {} })
    expect(dispatch).toHaveBeenCalledTimes(1)
    const action = dispatch.mock.calls[0][0]
    expect(action.type).toBe(UPDATE_USER_SETTINGS)
    expect(action.graphql.variables).toEqual({ changes: { settings: { timezone: 'Asia/Kolkata' } } })
  })

  it('saves it again only when it changed', async () => {
    withBrowserTimezone('America/New_York')
    const dispatch = jest.fn(action => Promise.resolve(action))
    await syncTimezone(dispatch, { id: '1', settings: { timezone: 'America/New_York' } })
    expect(dispatch).not.toHaveBeenCalled()

    await syncTimezone(dispatch, { id: '1', settings: { timezone: 'Europe/Berlin' } })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a signed-in person or a timezone, and never throws', async () => {
    const dispatch = jest.fn(() => Promise.reject(new Error('offline')))
    withBrowserTimezone('Europe/Berlin')
    expect(syncTimezone(dispatch, null)).toBeNull()
    await expect(syncTimezone(dispatch, { id: '1', settings: {} })).resolves.toBeNull()
    withBrowserTimezone('')
    expect(syncTimezone(dispatch, { id: '1', settings: {} })).toBeNull()
  })
})
