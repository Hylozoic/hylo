import { CalendarContext } from './calendar-context'
import { CalendarEvent, Mode } from './calendar-types'

export default function CalendarProvider({
  events,
  routeParams,
  locationParams,
  querystringParams,
  setEvents,
  mode,
  setMode,
  date,
  setDate,
  calendarIconIsToday = true,
  children,
}: {
  events: CalendarEvent[]
  routeParams: String
  locationParams: {
    [key: string]: String;
  }
  querystringParams: {
    [key: string]: String;
  }
  setEvents: (events: CalendarEvent[]) => void
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
        routeParams,
        locationParams,
        querystringParams,
        setEvents,
        mode,
        setMode,
        date,
        setDate,
        calendarIconIsToday,
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}
