import { DateTime } from 'luxon'
import type { Interval, DateTimeUnit } from 'luxon'
import {
  LOCALE_DE,
  LOCALE_EN_GB,
  LOCALE_EN_US,
  LOCALE_ES,
  LOCALE_FR,
  LOCALE_HI,
  LOCALE_PT,
  DateTimeHelpers,
  normalizeLocaleToFull
} from '@hylo/shared'
import { getDateLocale, getLocaleFromLocalStorage } from 'util/locale'
import { createPostUrl } from '@hylo/navigation'
import { de, enGB, enUS, es, fr, hi, pt } from 'react-day-picker/locale'
import type { HyloPost } from './calendar-types'

export const getLocaleForDayPicker = () => {
  switch (normalizeLocaleToFull(getLocaleFromLocalStorage())) {
    case LOCALE_EN_US:
      return enUS
    case LOCALE_EN_GB:
      return enGB
    case LOCALE_ES:
      return es
    case LOCALE_DE:
      return de
    case LOCALE_FR:
      return fr
    case LOCALE_HI:
      return hi
    case LOCALE_PT:
      return pt
    default:
      return enUS
  }
}

export const getHourCycle = () => {
  switch (normalizeLocaleToFull(getLocaleFromLocalStorage())) {
    case LOCALE_EN_US:
      return 12
    case LOCALE_EN_GB:
    case LOCALE_ES:
    case LOCALE_DE:
    case LOCALE_FR:
    case LOCALE_HI:
    case LOCALE_PT:
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
  const locale = getDateLocale()
  const _dt1 = DateTime.fromJSDate(dt1).setLocale(locale)
  const _dt2 = DateTime.fromJSDate(dt2).setLocale(locale)
  return _dt1.hasSame(_dt2, unit)
}

export const includes = (
  dt1 : Date,
  dt2 : Date,
  dt3 : Date
) : boolean => {
  const locale = getDateLocale()
  const _dt1 = DateTime.fromJSDate(dt1).setLocale(locale)
  const _dt2 = DateTime.fromJSDate(dt2).setLocale(locale)
  const _dt3 = DateTime.fromJSDate(dt3).setLocale(locale)
  return _dt2.hasSame(_dt1, 'day') ||
    _dt2.hasSame(_dt3, 'day') ||
    (_dt1 <= _dt2 && _dt2 < _dt3)
}

export const inWeek = (
  dt1 : Date,
  dt2 : Date,
  dt3 : Date
) : boolean => {
  const locale = getDateLocale()
  const _dt1 = DateTime.fromJSDate(dt1).setLocale(locale)
  const _dt2 = DateTime.fromJSDate(dt2).setLocale(locale)
  const _dt3 = DateTime.fromJSDate(dt3).setLocale(locale)
  const weekStart = _dt2.startOf('week', { useLocaleWeeks: true })
  const weekEnd = _dt2.endOf('week', { useLocaleWeeks: true })
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

/** Build create-post URL for a new event on a specific calendar day. */
export const createEventPostUrl = (
  routeParams: Record<string, string | string[]>,
  querystringParams: Record<string, string | string[]>,
  eventDate: Date
) => {
  const eventDateParam = DateTimeHelpers.toDateTime(eventDate, { locale: getLocaleFromLocalStorage() }).toISODate()
  return createPostUrl(routeParams, {
    ...querystringParams,
    newPostType: 'event',
    eventDate: eventDateParam
  })
}
