import { isMeetingUrl } from './url'

describe('isMeetingUrl', () => {
  it('detects Zoom, Google Meet, and Jitsi links', () => {
    expect(isMeetingUrl('https://zoom.us/j/1234567890')).toBe(true)
    expect(isMeetingUrl('https://us02web.zoom.us/j/1234567890')).toBe(true)
    expect(isMeetingUrl('https://meet.google.com/abc-defg-hij')).toBe(true)
    expect(isMeetingUrl('https://meet.jit.si/SomeRoomName')).toBe(true)
  })

  it('rejects non-meeting and empty URLs', () => {
    expect(isMeetingUrl('https://www.hylo.com/awitp')).toBe(false)
    expect(isMeetingUrl('https://zoominfo.com/j/1234567890')).toBe(false)
    expect(isMeetingUrl('')).toBe(false)
    expect(isMeetingUrl(null)).toBe(false)
  })
})
