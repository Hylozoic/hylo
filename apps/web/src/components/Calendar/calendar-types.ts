export const calendarModes = ['day', 'week', 'month'] as const
export type Mode = (typeof calendarModes)[number]

export type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  type: string
  multiday: boolean
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
  calendarIconIsToday?: boolean
}
