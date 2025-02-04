import React from 'react'
import { CalendarContext } from './calendar-context'
import { CalendarEvent, Mode } from './calendar-types'

export default function CalendarProvider ({
  events,
  routeParams,
  mode,
  setMode,
  date,
  setDate,
  calendarIconIsToday = true,
  children
}: {
  events: CalendarEvent[]
  routeParams: {
    [x: string]: string | string[];
  }
  mode: string
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
        routeParams,
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
