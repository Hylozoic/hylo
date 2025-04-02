'use client'

import React from 'react'
import type { CalendarProps } from './calendar-types'
import CalendarHeader from './header/calendar-header'
import CalendarBody from './body/calendar-body'
import CalendarHeaderActions from './header/actions/calendar-header-actions'
import CalendarHeaderDateChevrons from './header/date/calendar-header-date-chevrons'
import CalendarHeaderActionsMode from './header/actions/calendar-header-actions-mode'
import CalendarProvider from './calendar-provider'
import { DateTimeHelpers } from '@hylo/shared'
import { localeLocalStorageSync } from 'util/locale'
import { isMultiday } from './calendar-util'

export default function Calendar ({
  posts,
  group,
  routeParams,
  locationParams,
  querystringParams,
  calendarIconIsToday = true,
  date,
  setDate,
  mode,
  setMode
}: CalendarProps) {
  // map posts objects to calendar "event" objects
  const events = posts.map((post) => {
    return {
      id: post.id,
      start: DateTimeHelpers.toDateTime(post.startTime, { locale: localeLocalStorageSync() }).toJSDate(),
      end: DateTimeHelpers.toDateTime(post.endTime, { locale: localeLocalStorageSync() }).toJSDate(),
      title: post.title,
      type: post.type,
      multiday: isMultiday(post),
      post
    }
  })

  return (
    <CalendarProvider
      events={events}
      group={group}
      routeParams={routeParams}
      locationParams={locationParams}
      querystringParams={querystringParams}
      mode={mode}
      setMode={setMode}
      date={date}
      setDate={setDate}
      calendarIconIsToday={calendarIconIsToday}
    >
      <CalendarHeader>
        <CalendarHeaderDateChevrons />
        <CalendarHeaderActions>
          <CalendarHeaderActionsMode />
        </CalendarHeaderActions>
      </CalendarHeader>
      <CalendarBody />
    </CalendarProvider>
  )
}
