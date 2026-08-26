import { DateTime, DateTimeUnit, Info } from 'luxon'
import prettyDate from 'pretty-date'
import { LOCALE_EN_US, normalizeLocaleToFull } from '../LocaleHelpers'

export interface TimezoneOption {
  value: string
  label: string
  offset: number
}

export interface FormatEventTimeDisplayOptions {
  start: string | Date | DateTime | Object
  end?: string | Date | DateTime | Object | boolean
  eventTimezone?: string
  locale?: string
}

export interface FormatEventTimeDisplayResult {
  primary: string
  secondary: string | null
  eventTimezone: string
  userTimezone: string
  eventTimezoneLabel: string
  userTimezoneLabel: string
}

let cachedTimezones: string[] | null = null

export const dateTimeNow = (locale?: string) : DateTime => {
  return DateTime.now().setLocale(normalizeLocaleToFull(locale))
}

export interface ToDateTimeOptions {
  timezone?: string;
  locale?: string;
}

export const toDateTime = (
  dt: string | Date | DateTime | Object,
  options?: ToDateTimeOptions
): DateTime => {
  const { timezone, locale } = options || {};
  const zoneOption = { zone: timezone || DateTime.now().zoneName || 'UTC' }
  const _dt = dt instanceof DateTime
    ? dt
    : dt instanceof Date
      ? DateTime.fromJSDate(dt, zoneOption).setLocale(normalizeLocaleToFull(locale))
      : typeof dt === 'string'
        ? DateTime.fromISO(dt, zoneOption).setLocale(normalizeLocaleToFull(locale))
        : DateTime.fromObject(dt, zoneOption).setLocale(normalizeLocaleToFull(locale))
  if (_dt.invalidReason) {
    throw new Error(`Invalid date: ${_dt.invalidReason}`)
  }
  return _dt
}

const isSame = (
  dt1: string | Date | DateTime | Object,
  dt2: string | Date | DateTime | Object,
  unit: DateTimeUnit,
  locale?: string
): boolean => {
  const _dt1 = toDateTime(dt1, { locale })
  const _dt2 = toDateTime(dt2, { locale })
  return _dt1.hasSame(_dt2, unit)
}

export const rangeIncludesDate = (
  start: string | Date | DateTime | Object,
  date: string | Date | DateTime | Object,
  end: string | Date | DateTime | Object,
): boolean => {
  const _start = toDateTime(start)
  const _date = toDateTime(date)
  const _end = toDateTime(end)
  return _date.hasSame(_start, 'day')
    || _date.hasSame(_end, 'day')
    || (_start < _date && _date < _end)
}

export const inWeek = (
  start: string | Date | DateTime | Object,
  date: string | Date | DateTime | Object,
  end: string | Date | DateTime | Object
): boolean => {
  const _start = toDateTime(start)
  const _date = toDateTime(date)
  const _end = toDateTime(end)
  const weekStart = _date.startOf('week', { useLocaleWeeks: true })
  const weekEnd = _date.endOf('week', { useLocaleWeeks: true }).plus({ days: 1 })
  return _start < weekEnd && weekStart <= _end
}

export const isSameDay = (
  date1 : string | Date | DateTime | Object,
  date2 : string | Date | DateTime | Object
) : boolean => {
  return isSame(date1, date2, 'day')
}

/** Default start/end for a new event on a given calendar day (1 hour duration). */
export const defaultEventTimesForDate = (
  date: string | Date,
  locale?: string
): { startTime: Date; endTime: Date } => {
  const day = toDateTime(date, { locale }).startOf('day')
  const now = dateTimeNow(locale)
  let start = isSameDay(day.toJSDate(), now.toJSDate())
    ? now.plus({ hours: 1 }).startOf('hour')
    : day.set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
  if (start <= now) {
    start = now.plus({ minutes: 30 }).startOf('minute')
  }
  const end = start.plus({ hours: 1 })
  return { startTime: start.toJSDate(), endTime: end.toJSDate() }
}

export const isSameWeek = (
  date1 : string | Date | DateTime | Object,
  date2 : string | Date | DateTime | Object
) : boolean => {
  return isSame(date1, date2, 'week')
}

export const isSameMonth = (
  date1 : string | Date | DateTime | Object,
  date2 : string | Date | DateTime | Object
) : boolean => {
  return isSame(date1, date2, 'month')
}

export function humanDate (
  date: string | Date | DateTime | Object,
  short?: boolean,
  locale?: string
): string {
  const _date = toDateTime(date, { locale })
  let ret = _date.invalidReason ? '' : prettyDate.format(_date.toJSDate())

  // Always return 'now' for very recent timestamps
  if (ret === 'just now') {
    return 'now'
  }

  if (short) {
    ret = ret.replace(' ago', '')
  } else {
    if (ret.match(/(\d+) seconds? ago/)) {
      return 'now'
    }
  }

  return ret.replace(/ seconds?/, 's')
    .replace(/ minutes?/, 'm')
    .replace(/ hours?/, 'h')
    .replace(/ days?/, 'd')
    .replace(/ weeks?/, 'w')
    .replace(/ years?/, 'y')
    .replace(/ month(s?)/, ' mo$1')
}

/** Whether prose event dates place the day before the month (all locales except en-US). */
function usesDayBeforeMonth (locale?: string): boolean {
  return normalizeLocaleToFull(locale) !== LOCALE_EN_US
}

/** Luxon format strings for formatDatePair, ordered per locale convention. */
function getDatePairFormats (locale: string | undefined, skipTime: boolean) {
  const dayFirst = usesDayBeforeMonth(locale)
  const dateWithYear = dayFirst ? 'ccc d MMM yyyy' : 'ccc MMM d, yyyy'
  const dateWithoutYear = dayFirst ? 'ccc d MMM' : 'ccc MMM d'

  if (skipTime) {
    return {
      withYear: dateWithYear,
      withoutYear: dateWithoutYear,
      withYearWithTz: dateWithYear,
      withoutYearWithTz: dateWithoutYear
    }
  }

  return {
    withYear: `${dateWithYear} '•' t`,
    withoutYear: `${dateWithoutYear} '•' t`,
    withYearWithTz: `${dateWithYear} '•' t ZZZZ`,
    withoutYearWithTz: `${dateWithoutYear} '•' t ZZZZ`
  }
}

export interface FormatDatePairOptions {
  start: string | Date | DateTime | Object,
  end?: string | Date | DateTime | Object | boolean,
  returnAsObj?: boolean,
  timezone?: string,
  locale?: string,
  skipTime?: boolean
}

export const formatDatePair = ({
  start,
  end,
  returnAsObj = false,
  timezone,
  locale,
  skipTime = false
}: FormatDatePairOptions): string | { from: string, to: string } => {
  const _start = toDateTime(start, { timezone, locale })
  const _end = end ? toDateTime(end, { timezone, locale }) : null
  const now = dateTimeNow(locale)

  const {
    withYear: formatWithYear,
    withoutYear: formatWithoutYear,
    withYearWithTz: formatWithYearWithTz,
    withoutYearWithTz: formatWithoutYearWithTz
  } = getDatePairFormats(locale, skipTime)

  const isSameDay = _end && _start.get('day') === _end.get('day') &&
                    _start.get('month') === _end.get('month') &&
                    _start.get('year') === _end.get('year')

  let to = ''
  let from = ''

  // Format the start date - only include year if it's not this year
  // Include the timezone if the end date is not provided
  if (_start.get('year') !== now.get('year')) {
    from = _start.toFormat(end ? formatWithYear : formatWithYearWithTz)
  } else {
    from = _start.toFormat(end ? formatWithoutYear : formatWithoutYearWithTz)
  }

  // Format the end date/time if provided
  if (_end) {
    if (isSameDay) {
      // If same day, only show the end time (with timezone if not skipping time)
      to = _end.toFormat(skipTime ? 't' : 't ZZZZ')
    } else if (_end.get('year') < now.get('year')) {
      // If end date is in a past year, include the year (with timezone)
      to = _end.toFormat(formatWithYearWithTz)
    } else {
      // Otherwise just month, day and time (with timezone)
      to = _end.toFormat(formatWithoutYearWithTz)
    }
    to = returnAsObj ? to : ' - ' + to
  }

  return returnAsObj ? { from, to } : from + to
}

export function isDateInTheFuture (
  date: string | Date | DateTime | Object,
  locale?: string
): boolean {
  return toDateTime(date, { locale }) > dateTimeNow(locale)
}

/**
 * Returns the month name from a date string or Date object
 * @param {string|Date} date - Date string or Date object
 * @param {boolean} short - Whether to return short month name (e.g. 'Jan' vs 'January')
 * @param {string} timezone - Optional timezone (defaults to local timezone)
 * @param {string} locale - Optional locale for formatting
 * @returns {string} Month name
 */
export function getMonthFromDate (
  date: string | Date | DateTime | Object,
  short?: boolean,
  timezone?: string,
  locale?: string
): string {
  return toDateTime(date, { timezone, locale }).toFormat(short ? 'MMM' : 'MMMM')
}

/**
 * Returns the day number from a date string or Date object
 * @param {string|Date} date - Date string or Date object
 * @param {string} timezone - Optional timezone (defaults to local timezone)
 * @param {string} locale - Optional locale for formatting
 * @returns {number} Day of month (1-31)
 */
export function getDayFromDate (
  date: string | Date | DateTime | Object,
  timezone?: string,
): number {
  return toDateTime(date, { timezone }).day
}

/**
 * Returns the hour from a date string or Date object
 * @param {string|Date} date - Date string or Date object
 * @param {boolean} use24Hour - Whether to use 24-hour format (default: false)
 * @param {string} timezone - Optional timezone (defaults to local timezone)
 * @param {string} locale - Optional locale for formatting
 * @returns {string} Formatted hour (with AM/PM if use24Hour is false)
 */
export function getHourFromDate (
  date: string | Date | DateTime | Object,
  use24Hour?: boolean,
  timezone?: string
): string {
  return toDateTime(date, { timezone }).toFormat(use24Hour ? 'HH' : 'h a')
}

/** Returns the IANA timezone identifier for the current environment. */
export function getCurrentTimezone (): string {
  return DateTime.now().zoneName || 'UTC'
}

/** Returns all IANA timezone identifiers supported by the environment. */
export function getSupportedTimezones (): string[] {
  if (!cachedTimezones) {
    if (typeof Intl !== 'undefined' && typeof (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf === 'function') {
      cachedTimezones = (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone')
    } else {
      const luxonTimezones = (Info as { supportedTimezones?: () => string[] }).supportedTimezones
      cachedTimezones = luxonTimezones ? luxonTimezones() : ['UTC']
    }
  }
  return cachedTimezones
}

/** Returns a human-readable timezone name for display in selectors. */
export function getTimezoneFriendlyName (timezone: string, locale?: string): string {
  const loc = normalizeLocaleToFull(locale)
  try {
    const parts = new Intl.DateTimeFormat(loc, {
      timeZone: timezone,
      timeZoneName: 'longGeneric'
    }).formatToParts(new Date())
    const name = parts.find(part => part.type === 'timeZoneName')?.value
    if (name) return `${name} — ${timezone.replace(/_/g, ' ')}`
  } catch (e) {
    // Intl may reject invalid zones; fall back to the raw identifier.
  }
  return timezone.replace(/_/g, ' ')
}

/** Builds sorted timezone options for selectors, labeled with offset and friendly name. */
export function getTimezoneOptions (locale?: string): TimezoneOption[] {
  const loc = normalizeLocaleToFull(locale)
  const now = DateTime.now()
  return getSupportedTimezones().map(timezone => {
    const zoned = now.setZone(timezone)
    const offsetLabel = zoned.toFormat('ZZ')
    const friendlyName = getTimezoneFriendlyName(timezone, loc)
    return {
      value: timezone,
      label: `(${offsetLabel}) ${friendlyName}`,
      offset: zoned.offset
    }
  }).sort((a, b) => a.offset - b.offset || a.label.localeCompare(b.label))
}

/** Returns a short timezone abbreviation (e.g. PST, AEDT) for display labels. */
export function getTimezoneAbbreviation (timezone: string, locale?: string): string {
  return toDateTime(new Date(), { timezone, locale }).toFormat('ZZZZ')
}

/** Formats event times in the event timezone, with a secondary string in the viewer's timezone when different. */
export function formatEventTimeDisplay ({
  start,
  end,
  eventTimezone,
  locale
}: FormatEventTimeDisplayOptions): FormatEventTimeDisplayResult {
  const tz = eventTimezone || getCurrentTimezone()
  const userZone = getCurrentTimezone()
  const primary = formatDatePair({ start, end, timezone: tz, locale }) as string
  const secondary = userZone !== tz
    ? formatDatePair({ start, end, timezone: userZone, locale }) as string
    : null
  return {
    primary,
    secondary,
    eventTimezone: tz,
    userTimezone: userZone,
    eventTimezoneLabel: getTimezoneAbbreviation(tz, locale),
    userTimezoneLabel: getTimezoneAbbreviation(userZone, locale)
  }
}

/** Converts a stored instant to a Date whose local getters match wall-clock time in the given timezone (for date pickers). */
export function toPickerDate (instant: string | Date | DateTime | Object, timezone: string): Date {
  const dt = toDateTime(instant, { timezone })
  return new Date(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second, dt.millisecond)
}

/** Interprets a date picker's wall-clock components as an instant in the given timezone. */
export function fromPickerDate (pickerDate: Date, timezone: string): Date {
  return DateTime.fromObject({
    year: pickerDate.getFullYear(),
    month: pickerDate.getMonth() + 1,
    day: pickerDate.getDate(),
    hour: pickerDate.getHours(),
    minute: pickerDate.getMinutes(),
    second: pickerDate.getSeconds(),
    millisecond: pickerDate.getMilliseconds()
  }, { zone: timezone }).toJSDate()
}

/** Keeps the same wall-clock time when changing timezones (e.g. 3pm stays 3pm). */
export function preserveWallClockOnTimezoneChange (
  instant: string | Date | DateTime | Object | null | undefined,
  fromTimezone: string,
  toTimezone: string
): Date | null {
  if (!instant) return null
  if (fromTimezone === toTimezone) {
    return toDateTime(instant, { timezone: fromTimezone }).toJSDate()
  }
  const wall = toDateTime(instant, { timezone: fromTimezone })
  return DateTime.fromObject({
    year: wall.year,
    month: wall.month,
    day: wall.day,
    hour: wall.hour,
    minute: wall.minute,
    second: wall.second,
    millisecond: wall.millisecond
  }, { zone: toTimezone }).toJSDate()
}