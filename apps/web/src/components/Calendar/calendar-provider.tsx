import React from 'react'
import { CalendarContext } from './calendar-context'

export default function CalendarProvider (props) {
  const {
    events,
    group,
    routeParams,
    locationParams,
    querystringParams,
    mode,
    setMode,
    date,
    setDate,
    updateCalendarView,
    calendarIconIsToday = true,
    children
  } = props
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
        updateCalendarView,
        calendarIconIsToday
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}
