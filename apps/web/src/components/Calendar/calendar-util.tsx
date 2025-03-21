import { Interval } from 'luxon'
import { toDateTime, sameDay } from '@hylo/shared/src/DateTimeHelpers'
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

export const inWeek = (
  dt1 : Date,
  dt2 : Date,
  dt3 : Date
) : boolean => {
  const _dt1 = toDateTime(dt1)
  const _dt2 = toDateTime(dt2)
  const _dt3 = toDateTime(dt3)
  const weekStart = _dt2.startOf('week', { useLocaleWeeks: true })
  const weekEnd = _dt2.endOf('week', { useLocaleWeeks: true }).plus({ days: 1 })
  return _dt1 < weekEnd && weekStart <= _dt3
}

export const eachIntervalDay = (
  interval: Interval
): Date[] => {
  return Array.from({ length: interval.length('day') }, (_, i) => interval.start.plus({ day: i }).toJSDate())
}

export const isMultiday = (
  post: HyloPost
) : boolean => {
  return !sameDay(post.startTime, post.endTime)
}
