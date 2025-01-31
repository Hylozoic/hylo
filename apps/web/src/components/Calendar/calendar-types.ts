export const calendarModes = ['day', 'week', 'month'] as const
export type Mode = (typeof calendarModes)[number]

export type CalendarEvent = {
  id: string
  title: string
  color: string
  start: Date
  end: Date
}

export type CalendarProps = {
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
  calendarIconIsToday?: boolean
}

export type CalendarContextType = CalendarProps & {
  routeParams: String
  locationParams: {
    [key: string]: String;
  }
  querystringParams: {
    [key: string]: String;
  }
}
