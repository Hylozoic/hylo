import {
  buildEventIcs,
  canAddEventToCalendar,
  eventCalendarDetails,
  eventCalendarUid,
  eventIcsFilename,
  googleCalendarEventUrl,
  toCalendarDateTime
} from './eventCalendar'

const EVENT_URL = 'https://www.hylo.com/post/42'
const event = {
  id: '42',
  title: 'Garden work day',
  startTime: '2026-11-08T18:00:00.000Z',
  endTime: '2026-11-08T20:30:00.000Z',
  location: 'Community Garden, 1 Main St',
  details: '<p>Bring gloves; we have tools.</p>'
}

describe('eventCalendar', () => {
  it('formats UTC calendar date-times', () => {
    expect(toCalendarDateTime(new Date('2026-11-08T18:05:09.123Z'))).toBe('20261108T180509Z')
  })

  it('uses the same UID as the backend invites and feeds', () => {
    expect(eventCalendarUid('42')).toBe('event-42-hylo.com')
  })

  it('needs an id and a valid start time', () => {
    expect(canAddEventToCalendar(event)).toBe(true)
    expect(canAddEventToCalendar(null)).toBe(false)
    expect(canAddEventToCalendar({ id: '1' })).toBe(false)
    expect(canAddEventToCalendar({ id: '1', startTime: 'not a date' })).toBe(false)
  })

  describe('eventCalendarDetails', () => {
    it('uses the physical location and ends the description with the event link', () => {
      const details = eventCalendarDetails(event, EVENT_URL)
      expect(details.title).toBe('Garden work day')
      expect(details.location).toBe('Community Garden, 1 Main St')
      expect(details.description).toBe(`Bring gloves; we have tools.\n\n${EVENT_URL}`)
    })

    it('uses the meeting link as the location for online events', () => {
      const details = eventCalendarDetails({ ...event, location: '', meetingLink: 'https://zoom.us/j/1' }, EVENT_URL)
      expect(details.location).toBe('https://zoom.us/j/1')
    })

    it('puts the meeting link in the description when there is also a physical location', () => {
      const details = eventCalendarDetails({ ...event, meetingLink: 'https://zoom.us/j/1' }, EVENT_URL)
      expect(details.location).toBe('Community Garden, 1 Main St')
      expect(details.description).toBe(`Bring gloves; we have tools.\n\nhttps://zoom.us/j/1\n\n${EVENT_URL}`)
    })

    it('defaults to one hour when the end time is missing or not after the start', () => {
      expect(eventCalendarDetails({ ...event, endTime: null }).end.toISOString()).toBe('2026-11-08T19:00:00.000Z')
      expect(eventCalendarDetails({ ...event, endTime: event.startTime }).end.toISOString()).toBe('2026-11-08T19:00:00.000Z')
    })
  })

  it('builds a Google Calendar event link', () => {
    const url = new URL(googleCalendarEventUrl(event, EVENT_URL))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Garden work day')
    expect(url.searchParams.get('dates')).toBe('20261108T180000Z/20261108T203000Z')
    expect(url.searchParams.get('location')).toBe('Community Garden, 1 Main St')
    expect(url.searchParams.get('details')).toBe(`Bring gloves; we have tools.\n\n${EVENT_URL}`)
  })

  it('shortens long descriptions in the Google Calendar link but keeps the event link', () => {
    const url = new URL(googleCalendarEventUrl({ ...event, details: `<p>${'a'.repeat(5000)}</p>` }, EVENT_URL))
    const details = url.searchParams.get('details')
    expect(details.length).toBeLessThan(1600)
    expect(details.endsWith(EVENT_URL)).toBe(true)
  })

  describe('buildEventIcs', () => {
    const now = new Date('2026-11-05T12:00:00.000Z')

    it('builds one VEVENT with escaped text and CRLF line endings', () => {
      const ics = buildEventIcs(event, EVENT_URL, now)
      // unfold (RFC 5545 continuation lines) before reading lines
      const lines = ics.replace(/\r\n /g, '').split('\r\n')
      expect(lines.slice(0, 6)).toEqual([
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Hylo//Hylo Events//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT'
      ])
      expect(lines).toContain('UID:event-42-hylo.com')
      expect(lines).toContain('DTSTAMP:20261105T120000Z')
      expect(lines).toContain('DTSTART:20261108T180000Z')
      expect(lines).toContain('DTEND:20261108T203000Z')
      expect(lines).toContain('SUMMARY:Garden work day')
      expect(lines).toContain('LOCATION:Community Garden\\, 1 Main St')
      expect(lines).toContain(`DESCRIPTION:Bring gloves\\; we have tools.\\n\\n${EVENT_URL}`)
      expect(lines).toContain(`URL:${EVENT_URL}`)
      expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true)
      expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/)
    })

    it('folds long lines at 75 octets without splitting characters', () => {
      const title = 'Größe '.repeat(30)
      const ics = buildEventIcs({ ...event, title }, EVENT_URL, now)
      const encoder = new TextEncoder()
      ics.split('\r\n').forEach(line => expect(encoder.encode(line).length).toBeLessThanOrEqual(75))
      const unfolded = ics.replace(/\r\n /g, '')
      expect(unfolded).toContain(`SUMMARY:${title}`)
    })

    it('leaves out an empty location and description', () => {
      const ics = buildEventIcs({ id: '1', title: 'x', startTime: event.startTime }, '', now)
      expect(ics).not.toContain('LOCATION')
      expect(ics).not.toContain('DESCRIPTION')
      expect(ics).not.toContain('URL:')
    })
  })

  it('names the file after the event', () => {
    expect(eventIcsFilename(event)).toBe('garden-work-day.ics')
    expect(eventIcsFilename({ title: 'Café Night!' })).toBe('cafe-night.ics')
    expect(eventIcsFilename({ title: 'पिकनिक' })).toBe('event.ics')
    expect(eventIcsFilename({})).toBe('event.ics')
  })
})
