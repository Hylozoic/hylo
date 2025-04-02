import { DateTime, DateTimeUnit } from 'luxon';

export interface ToDateTimeOptions {
  timezone?: string;
  locale?: string;
}

export function dateTimeNow(locale?: string): DateTime;

export function toDateTime(
  dt: string | Date | DateTime | Object,
  options?: ToDateTimeOptions
): DateTime;

export function rangeIncludesDate(
  start: string | Date | DateTime | Object,
  date: string | Date | DateTime | Object,
  end: string | Date | DateTime | Object,
  locale?: string
): boolean;

export function inWeek(
  start: string | Date | DateTime | Object,
  date: string | Date | DateTime | Object,
  end: string | Date | DateTime | Object,
  locale?: string
): boolean;

export function isSameDay(
  date1: string | Date | DateTime | Object,
  date2: string | Date | DateTime | Object,
  locale?: string
): boolean;

export function isSameWeek(
  date1: string | Date | DateTime | Object,
  date2: string | Date | DateTime | Object,
  locale?: string
): boolean;

export function isSameMonth(
  date1: string | Date | DateTime | Object,
  date2: string | Date | DateTime | Object,
  locale?: string
): boolean;

export function humanDate(
  date: string | Date | DateTime | Object,
  short?: boolean,
  locale?: string
): string;

export function formatDatePair(
  start: string | Date | DateTime | Object,
  end: string | Date | DateTime | Object | boolean,
  returnAsObj?: boolean,
  timezone?: string,
  locale?: string
): string | { from: string, to: string };

export function isDateInTheFuture(
  date: string | Date | DateTime | Object,
  locale?: string
): boolean;

export function getMonthFromDate(
  date: string | Date | DateTime | Object,
  short?: boolean,
  timezone?: string,
  locale?: string
): string;

export function getDayFromDate(
  date: string | Date | DateTime | Object,
  timezone?: string,
  locale?: string
): number;

export function getHourFromDate(
  date: string | Date | DateTime | Object,
  use24Hour?: boolean,
  timezone?: string,
  locale?: string
): string; 