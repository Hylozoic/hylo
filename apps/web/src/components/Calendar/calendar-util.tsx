import { DateTime, Interval, DateTimeUnit } from 'luxon'
import { HyloPost } from './calendar-types'

export const same = (
  dt1 : Date,
  dt2 : Date,
  unit: DateTimeUnit
): boolean => {
  return DateTime.fromJSDate(dt1).hasSame(DateTime.fromJSDate(dt2), unit)
}

export const includes = (
  dt1 : Date,
  dt2 : Date,
  dt3 : Date
) : boolean => {
  const _dt1 = DateTime.fromJSDate(dt1)
  const _dt2 = DateTime.fromJSDate(dt2)
  const _dt3 = DateTime.fromJSDate(dt3)
  return _dt2.hasSame(_dt1, 'day') ||
    _dt2.hasSame(_dt3, 'day') ||
    (_dt1 < _dt2 && _dt2 < _dt3)
}

export const sameDay = (
  dt1 : Date,
  dt2 : Date,
  dt3? : Date
): boolean => {
  return dt3 ? includes(dt1, dt2, dt3) : same(dt1, dt2, 'day')
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
