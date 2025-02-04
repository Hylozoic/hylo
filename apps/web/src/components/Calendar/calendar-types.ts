export const calendarModes = ['day', 'week', 'month'] as const
export type Mode = (typeof calendarModes)[number]

export type CalendarEvent = {
  id: string
  title: string
  color: string
  start: Date
  end: Date
}

export type HyloPost = {
  id: string
  startTime: string
  endTime: string
  title: string
  group: string
  type: string
}

export type CalendarProps = {
  posts?: HyloPost[]
  events?: CalendarEvent[]
  routeParams: string
  locationParams: {
    [key: string]: string;
  }
  querystringParams: {
    [key: string]: string;
  }
  setEvents: (events: CalendarEvent[]) => void
  mode: string
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
