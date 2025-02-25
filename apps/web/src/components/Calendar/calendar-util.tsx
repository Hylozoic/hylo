import { DateTime, Interval, DateTimeUnit } from 'luxon'
import { localeLocalStorageSync } from 'util/locale'
import { enUS, es } from 'react-day-picker/locale'
import { HyloPost } from './calendar-types'

export const getLocaleAsString = () => {
  switch (localeLocalStorageSync()) {
    case 'en':
      return 'en-US'
    case 'es':
      return 'es'
    default:
      return 'en-US'
  }
}

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

export const same = (
  dt1 : Date,
  dt2 : Date,
  unit: DateTimeUnit
): boolean => {
  const _dt1 = DateTime.fromJSDate(dt1).setLocale(getLocaleAsString())
  const _dt2 = DateTime.fromJSDate(dt2).setLocale(getLocaleAsString())
  return _dt1.hasSame(_dt2, unit)
}

export const includes = (
  dt1 : Date,
  dt2 : Date,
  dt3 : Date
) : boolean => {
  const _dt1 = DateTime.fromJSDate(dt1).setLocale(getLocaleAsString())
  const _dt2 = DateTime.fromJSDate(dt2).setLocale(getLocaleAsString())
  const _dt3 = DateTime.fromJSDate(dt3).setLocale(getLocaleAsString())
  return _dt2.hasSame(_dt1, 'day') ||
    _dt2.hasSame(_dt3, 'day') ||
    (_dt1 <= _dt2 && _dt2 < _dt3)
}

export const inWeek = (
  dt1 : Date,
  dt2 : Date,
  dt3 : Date
) : boolean => {
  const _dt1 = DateTime.fromJSDate(dt1).setLocale(getLocaleAsString())
  const _dt2 = DateTime.fromJSDate(dt2).setLocale(getLocaleAsString())
  const _dt3 = DateTime.fromJSDate(dt3).setLocale(getLocaleAsString())
  const weekStart = _dt2.startOf('week', { useLocaleWeeks: true })
  const weekEnd = _dt2.endOf('week', { useLocaleWeeks: true }).plus({ days: 1 })
  return _dt1 < weekEnd && weekStart <= _dt3
}

export const sameDay = (
  dt1 : Date,
  dt2 : Date,
  dt3? : Date
): boolean => {
  return dt3 ? includes(dt1, dt2, dt3) : same(dt1, dt2, 'day')
}

export const sameWeek = (
  dt1: Date,
  dt2: Date
): boolean => {
  return same(dt1, dt2, 'week')
}

export const sameMonth = (
  dt1: Date,
  dt2: Date
): boolean => {
  return same(dt1, dt2, 'month')
}

export const eachIntervalDay = (
  interval: Interval
): Date[] => {
  return Array.from({ length: interval.length('day') }, (_, i) => interval.start.plus({ day: i }).toJSDate())
}

export const isMultiday = (
  post: HyloPost
) : boolean => {
  return !DateTime.fromISO(post.startTime).hasSame(DateTime.fromISO(post.endTime), 'day')
}
