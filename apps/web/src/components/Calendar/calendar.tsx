'use client'

import React, { useState } from 'react'
import type { CalendarProps } from './calendar-types'
import CalendarHeader from './header/calendar-header'
import CalendarBody from './body/calendar-body'
import CalendarHeaderActions from './header/actions/calendar-header-actions'
import CalendarHeaderDate from './header/date/calendar-header-date'
import CalendarHeaderActionsMode from './header/actions/calendar-header-actions-mode'
import CalendarProvider from './calendar-provider'
import { DateTime } from 'luxon'

// TODO can we replace props with useRoute return values?
export default function Calendar ({
  posts,
  routeParams,
  locationParams,
  querystringParams,
  setEvents,
  calendarIconIsToday = true
}: CalendarProps) {
  const [mode, setMode] = useState('month')
  const [date, setDate] = useState(new Date())

  // map posts objects to calendar "event" objects
  // unique color per post type
  const color = {
    event: 'emerald',
    project: 'indigo',
    request: 'blue',
    offer: 'orange'
  }
  const events = posts.map((post) => {
    return {
      id: post.id,
      start: DateTime.fromISO(post.startTime).toJSDate(),
      end: DateTime.fromISO(post.endTime).toJSDate(),
      title: post.title,
      color: color[post.type] || 'amber'
    }
  })

  return (
    <CalendarProvider
      events={events}
      routeParams={routeParams}
      locationParams={locationParams}
      querystringParams={querystringParams}
      setEvents={setEvents}
      mode={mode}
      setMode={setMode}
      date={date}
      setDate={setDate}
      calendarIconIsToday={calendarIconIsToday}
    >
      <CalendarHeader>
        <CalendarHeaderDate />
        <CalendarHeaderActions>
          <CalendarHeaderActionsMode />
        </CalendarHeaderActions>
      </CalendarHeader>
      <CalendarBody />
    </CalendarProvider>
  )
}
