import { createContext, useContext } from 'react'
import type { CalendarProps } from './calendar-types'

export const CalendarContext = createContext<CalendarProps | undefined>(
  undefined
)

export function useCalendarContext () {
  const context = useContext(CalendarContext)
  if (!context) {
    throw new Error('useCalendarContext must be used within a CalendarProvider')
  }
  return context
}
