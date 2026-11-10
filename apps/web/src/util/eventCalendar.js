import { TextHelpers } from '@hylo/shared'

/**
 * Single-event "add to calendar" helpers: a Google Calendar link and an .ics file, built from
 * the event post already in the store (title, startTime, endTime, location, meetingLink, details).
 */

const GOOGLE_CALENDAR_EVENT_URL = 'https://calendar.google.com/calendar/render'
const DEFAULT_DURATION_MS = 60 * 60 * 1000
// Google Calendar links over ~8k characters fail, so long event descriptions are cut short there
const GOOGLE_DESCRIPTION_MAX_LENGTH = 1500

// Same UID as the backend's Post#iCalUid (RSVP email invites, calendar feeds), so a calendar
// treats this file and those as the same event instead of adding a duplicate
export function eventCalendarUid (id) {
  return `event-${id}-hylo.com`
}

/** Whether the event has enough data (an id and a valid start time) to add to a calendar. */
export function canAddEventToCalendar (event) {
  return Boolean(event?.id && toDate(event.startTime))
}

function toDate (value) {
  if (!value) return null
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date
}

/** 2026-11-05T14:30:00.000Z -> 20261105T143000Z (UTC, as used by .ics and Google Calendar) */
export function toCalendarDateTime (date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Title, UTC start/end, physical location, meeting link and plain-text description.
 * The meeting link is kept separate so .ics can put it in CONFERENCE. The Hylo link ends the description.
 */
export function eventCalendarDetails (event, eventUrl) {
  const start = toDate(event.startTime)
  const end = toDate(event.endTime) || new Date(start.getTime() + DEFAULT_DURATION_MS)
  const location = event.location || ''
  const meetingLink = (event.meetingLink || '').trim()
  const description = [
    TextHelpers.presentHTMLToText(event.details || ''),
    meetingLink && `Join online: ${meetingLink}`,
    eventUrl
  ].filter(Boolean).join('\n\n')

  return {
    title: event.title || '',
    start,
    end: end > start ? end : new Date(start.getTime() + DEFAULT_DURATION_MS),
    location,
    meetingLink,
    description
  }
}

/** Keeps the join link when a long description is cut down for Google's URL length limit. */
function googleCalendarDetails (description, eventUrl, meetingLink) {
  if (description.length <= GOOGLE_DESCRIPTION_MAX_LENGTH) return description
  const tail = [meetingLink && `Join online: ${meetingLink}`, eventUrl].filter(Boolean).join('\n\n')
  const room = Math.max(0, GOOGLE_DESCRIPTION_MAX_LENGTH - tail.length - 2)
  const head = room > 0 ? `${description.slice(0, room).trimEnd()}…` : ''
  return [head, tail].filter(Boolean).join('\n\n')
}

export function googleCalendarEventUrl (event, eventUrl) {
  const { title, start, end, location, meetingLink, description } = eventCalendarDetails(event, eventUrl)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toCalendarDateTime(start)}/${toCalendarDateTime(end)}`,
    details: googleCalendarDetails(description, eventUrl, meetingLink),
    // No conference parameter exists on this URL. A join link goes in location only
    // when the event has no street address, and it is always in details.
    location: location || meetingLink
  })
  return `${GOOGLE_CALENDAR_EVENT_URL}?${params.toString()}`
}

// RFC 5545 TEXT escaping
function escapeIcsText (text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

// RFC 5545 line folding: lines of at most 75 octets, continued with CRLF + space
function foldIcsLine (line) {
  const encoder = new TextEncoder()
  const parts = []
  let current = ''
  let currentBytes = 0
  for (const char of line) {
    const bytes = encoder.encode(char).length
    const limit = parts.length === 0 ? 75 : 74 // continuation lines start with a space
    if (currentBytes + bytes > limit) {
      parts.push(current)
      current = ''
      currentBytes = 0
    }
    current += char
    currentBytes += bytes
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export function buildEventIcs (event, eventUrl, now = new Date()) {
  const { title, start, end, location, meetingLink, description } = eventCalendarDetails(event, eventUrl)
  const conferenceUri = meetingLink.replace(/[\r\n]/g, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hylo//Hylo Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${eventCalendarUid(event.id)}`,
    `DTSTAMP:${toCalendarDateTime(now)}`,
    `DTSTART:${toCalendarDateTime(start)}`,
    `DTEND:${toCalendarDateTime(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    description && `DESCRIPTION:${escapeIcsText(description)}`,
    location && `LOCATION:${escapeIcsText(location)}`,
    conferenceUri && `CONFERENCE;VALUE=URI;FEATURE=AUDIO,VIDEO;LABEL=Join online:${conferenceUri}`,
    conferenceUri && `X-GOOGLE-CONFERENCE:${escapeIcsText(conferenceUri)}`,
    eventUrl && `URL:${eventUrl}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean)
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

export function eventIcsFilename (event) {
  const slug = (event.title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'event'}.ics`
}

/**
 * Downloads the event as an .ics file, which the browser / OS opens in the default calendar app
 * (Apple Calendar, Outlook). Blob downloads don't work in the mobile app's WebView, so callers
 * hide this there.
 */
export function downloadEventIcs (event, eventUrl) {
  const blob = new Blob([buildEventIcs(event, eventUrl)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = eventIcsFilename(event)
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Safari reads the blob asynchronously after the click, so don't revoke it straight away
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
