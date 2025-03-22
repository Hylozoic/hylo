import { Interval } from 'luxon'
import { DateTimeHelpers } from '@hylo/shared'
import { localeLocalStorageSync } from 'util/locale'
import { enUS, es } from 'react-day-picker/locale'
import { HyloPost } from './calendar-types'

export const getLocaleForDayPicker = () => {
  switch (localeLocalStorageSync()) {
    case 'en':
      return enUS
    case 'es':
      return es
    default:
      return enUS
  }
}

export const getHourCycle = () => {
  switch (localeLocalStorageSync()) {
    case 'en':
      return 12
    case 'es':
      return 24
    default:
      return 24
  }
}

export const eachIntervalDay = (
  interval: Interval
): Date[] => {
  return Array.from({ length: interval.length('day') }, (_, i) => interval.start.plus({ day: i }).toJSDate())
}

export const isMultiday = (
  post: HyloPost
) : boolean => {
  return !DateTimeHelpers.isSameDay(post.startTime, post.endTime)
}
