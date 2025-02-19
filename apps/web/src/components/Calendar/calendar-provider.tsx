import React from 'react'
import { CalendarContext } from './calendar-context'
import { CalendarEvent, Mode } from './calendar-types'

export default function CalendarProvider ({
  events,
  mode,
  setMode,
  date,
  setDate,
  calendarIconIsToday = true,
  children
}: {
  events: CalendarEvent[]
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
