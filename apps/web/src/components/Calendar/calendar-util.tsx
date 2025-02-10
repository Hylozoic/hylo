import { DateTime, Interval, DateTimeUnit } from 'luxon'

export const same = (
  dt1 : Date,
  dt2 : Date,
  unit: DateTimeUnit
): Boolean => {
  return DateTime.fromJSDate(dt1).hasSame(DateTime.fromJSDate(dt2), unit)
}

export const sameDay = (
  dt1 : Date,
  dt2 : Date
): Boolean => {
  return same(dt1, dt2, 'day')
}

export const sameMonth = (
  dt1: Date,
  dt2: Date
): Boolean => {
  return same(dt1, dt2, 'month')
}

export const eachIntervalDay = (
  interval: Interval
): Date[] => {
  return Array.from({ length: interval.length('day') }, (_, i) => interval.start.plus({ day: i }).toJSDate())
}
