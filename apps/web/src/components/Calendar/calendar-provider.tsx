import React from 'react'
import { CalendarContext } from './calendar-context'
import { CalendarEvent, HyloGroup, Mode } from './calendar-types'

export default function CalendarProvider ({
  events,
  group,
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
  group: HyloGroup
  routeParams: {
    [x: string]: string | string[];
  }
  locationParams: {
    [x: string]: string | string[];
  }
  querystringParams: {
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
        group,
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
