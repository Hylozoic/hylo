import React from 'react'
import { CalendarContext } from './calendar-context'
import { CalendarEvent, Mode } from './calendar-types'

export default function CalendarProvider ({
  events,
  setEvents,
  routeParams,
  locationParams,
  querystringParams,
  mode,
  setMode,
  date,
  setDate,
  calendarIconIsToday = true,
  children
}: {
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  routeParams: String
  locationParams: {
    [key: string]: String;
  }
  querystringParams: {
    [key: string]: String;
  }
  mode: Mode
  setMode: (mode: Mode) => void
  date: Date
  setDate: (date: Date) => void
  calendarIconIsToday: boolean
  children: React.ReactNode
}) {
  return (
    <CalendarContext.Provider
      value={{
        events,
        setEvents,
        routeParams,
        locationParams,
        querystringParams,
        mode,
        setMode,
        date,
        setDate,
        calendarIconIsToday
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}
