import { DateTime, DateTimeUnit } from 'luxon'
import { localeLocalStorageSync } from '../../../apps/web/src/util/locale'

export const getLocaleAsString = () : string => {
  switch (localeLocalStorageSync()) {
    case 'en':
      return 'en-US'
    case 'es':
      return 'es'
    default:
      return 'en-US'
  }
}

export const dateTimeNow = () : DateTime => {
  return DateTime.now().setLocale(getLocaleAsString())
}

export const toDateTime = (
  dt : string | Date | DateTime | Object,
  timezone? : string
) : DateTime => {
  const now = DateTime.now()
  const _dt = dt instanceof DateTime
    ? dt
    : dt instanceof Date
      ? DateTime.fromJSDate(dt, { zone: timezone || now.zoneName || 'UTC' })
      : typeof dt === 'string'
        ? DateTime.fromISO(dt, { zone: timezone || now.zoneName || 'UTC' })
        : DateTime.fromObject(dt, { zone: timezone || now.zoneName || 'UTC' })
  return _dt.setLocale(getLocaleAsString())
}

const same = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object,
  unit : DateTimeUnit
) : boolean => {
  const _dt1 = toDateTime(dt1)
  const _dt2 = toDateTime(dt2)
  return _dt1.hasSame(_dt2, unit)
}

export const includes = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object,
  dt3 : string | Date | DateTime | Object
) : boolean => {
  const _dt1 = toDateTime(dt1)
  const _dt2 = toDateTime(dt2)
  const _dt3 = toDateTime(dt3)
  return _dt2.hasSame(_dt1, 'day')
    || _dt2.hasSame(_dt3, 'day')
    || (_dt1 <= _dt2 && _dt2 < _dt3)
}

export const inWeek = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object,
  dt3 : string | Date | DateTime | Object
) : boolean => {
  const _dt1 = toDateTime(dt1)
  const _dt2 = toDateTime(dt2)
  const _dt3 = toDateTime(dt3)
  const weekStart = _dt2.startOf('week', { useLocaleWeeks: true })
  const weekEnd = _dt2.endOf('week', { useLocaleWeeks: true }).plus({ days: 1 })
  return _dt1 < weekEnd && weekStart <= _dt3
}

export const sameDay = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object,
  dt3? : string | Date | DateTime | Object
) : boolean => {
  return dt3 ? includes(dt1, dt2, dt3) : same(dt1, dt2, 'day')
}

export const sameWeek = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object
) : boolean => {
  return same(dt1, dt2, 'week')
}

export const sameMonth = (
  dt1 : string | Date | DateTime | Object,
  dt2 : string | Date | DateTime | Object
) : boolean => {
  return same(dt1, dt2, 'month')
}
