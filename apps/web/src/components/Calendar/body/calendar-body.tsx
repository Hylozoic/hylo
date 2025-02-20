import React from 'react'
import { useCalendarContext } from '../calendar-context'
import CalendarBodyDay from './day/calendar-body-day'
import CalendarBodyMonth from './month/calendar-body-month'

export default function CalendarBody () {
  const { mode } = useCalendarContext()

  return (
    <>
      {mode === 'day' && <CalendarBodyDay />}
      {mode === 'month' && <CalendarBodyMonth />}
    </>
  )
}
