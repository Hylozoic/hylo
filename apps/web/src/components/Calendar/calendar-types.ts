export const calendarModes = ['day', 'week', 'month'] as const
export type Mode = (typeof calendarModes)[number]

export type HyloGroup = {
  slug: string
  id: string
}

export type HyloPost = {
  id: string
  startTime: string
  endTime: string
  title: string
  groups: HyloGroup[]
  type: string
}

export type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  type: string
  multiday: boolean
  post: HyloPost
}

export type CalendarProps = {
  posts?: HyloPost[]
  events?: CalendarEvent[]
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
  calendarIconIsToday?: boolean
}
