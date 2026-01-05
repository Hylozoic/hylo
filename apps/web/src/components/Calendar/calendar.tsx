'use client'

import React from 'react'
import isMobile from 'ismobilejs'
import type { CalendarProps } from './calendar-types'
import CalendarHeader from './header/calendar-header'
import CalendarBody from './body/calendar-body'
import CalendarBodyDayCalendar from './body/day/calendar-body-day-calendar'
import CalendarHeaderActions from './header/actions/calendar-header-actions'
import CalendarHeaderDateChevrons from './header/date/calendar-header-date-chevrons'
import CalendarHeaderActionsMode from './header/actions/calendar-header-actions-mode'
import CalendarProvider from './calendar-provider'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'
import { isMultiday } from './calendar-util'
import CalendarBodyDay from './body/day/calendar-body-day'

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
      start: DateTimeHelpers.toDateTime(post.startTime, { locale: getLocaleFromLocalStorage() }).toJSDate(),
      end: DateTimeHelpers.toDateTime(post.endTime, { locale: getLocaleFromLocalStorage() }).toJSDate(),
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
      {isMobile.any && (
        <>
          <CalendarBodyDayCalendar />
          <CalendarBodyDay />
        </>
      )}
      {!isMobile.any && (
        <>
          <CalendarHeader>
            <CalendarHeaderDateChevrons />
            <CalendarHeaderActions>
              <CalendarHeaderActionsMode />
            </CalendarHeaderActions>
          </CalendarHeader>
          <CalendarBody />
        </>
      )}
    </CalendarProvider>
  )
}
