import React from 'react'
import { useCalendarContext } from 'components/Calendar/calendar-context'
import { Interval } from 'luxon'
import Tooltip from 'components/Tooltip'
import { DateTimeHelpers } from '@hylo/shared'
import useViewPostDetails from 'hooks/useViewPostDetails'
import { cn } from 'util/index'
import { getLocaleFromLocalStorage } from 'util/locale'
import { useTranslation } from 'react-i18next'

import classes from './calendar.module.scss'

function getOverlappingEvents (currentEvent, events) {
  const dt1 = DateTimeHelpers.toDateTime(currentEvent.start, { locale: getLocaleFromLocalStorage() })
  return events.filter((event) => {
    if (event.id === currentEvent.id) return true
    const dt2 = DateTimeHelpers.toDateTime(event.start, { locale: getLocaleFromLocalStorage() })
    const interval = Interval.fromDateTimes(dt1, dt2)
    return Math.abs(interval.length('minutes')) <= 15
  })
}

function calculateEventPosition (event, allEvents, day) {
  const overlappingEvents = getOverlappingEvents(event, allEvents)
  const group = overlappingEvents.sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  )
  const position = group.indexOf(event)
  const width = `${100 / (overlappingEvents.length)}%`
  const left = `${(position * 100) / (overlappingEvents.length)}%`

  const startHour = (day && event.start.getTime() < day.getTime()) ? 0 : event.start.getHours()
  const startMinutes = event.start.getMinutes()

  let endHour = event.end.getHours()
  let endMinutes = event.end.getMinutes()

  if (!DateTimeHelpers.isSameDay(event.start, event.end)) {
    endHour = 23
    endMinutes = 59
  }

  const topPosition = startHour * 128 + (startMinutes / 60) * 128
  const duration = endHour * 60 + endMinutes - (startHour * 60 + startMinutes)
  const height = (duration / 60) * 128

  return {
    left,
    width,
    top: `${topPosition}px`,
    height: `${height}px`
  }
}

export default function CalendarEvent ({
  event,
  month = false,
  className,
  day
}) {
  const { t } = useTranslation()
  const { events } = useCalendarContext()
  const style = month ? {} : calculateEventPosition(event, events, day)
  const locale = getLocaleFromLocalStorage()
  const { primary, secondary, eventTimezoneLabel, userTimezoneLabel } = DateTimeHelpers.formatEventTimeDisplay({
    start: event.start,
    end: event.end,
    eventTimezone: event.post?.timezone,
    locale
  })
  const toolTipTitle = secondary
    ? `${event.title}<br />${primary}<br /><span style="opacity:0.7">${t('Event time ({{timezone}})', { timezone: eventTimezoneLabel })}</span><br /><span style="opacity:0.7">${t('Your time ({{timezone}}): {{time}}', { timezone: userTimezoneLabel, time: secondary })}</span>`
    : `${event.title}<br />${primary}<br /><span style="opacity:0.7">${t('Event time ({{timezone}})', { timezone: eventTimezoneLabel })}</span>`

  const viewPostDetails = useViewPostDetails()

  // Month view mounts one chip per day. Do not give them a shared layoutId:
  // Framer Motion shows only one element per id (the last day), then springs
  // the earlier days back into place.
  return (
    <>
      <div
        className={cn(
          classes[event.type],
          'cursor-pointer border',
          month && event.multiday && DateTimeHelpers.isSameDay(event.start, day) && 'rounded-l-md border-r-0',
          month && event.multiday && DateTimeHelpers.isSameDay(event.end, day) && 'rounded-r-md border-l-0 mr-1',
          month && event.multiday && !DateTimeHelpers.isSameDay(event.start, day) && !DateTimeHelpers.isSameDay(event.end, day) && 'border-l-0 border-r-0',
          month && !event.multiday && 'rounded-md mr-1',
          !month && 'absolute',
          className
        )}
        style={style}
        onClick={(e) => {
          e.stopPropagation()
          viewPostDetails(event)
        }}
        data-tooltip-id={`title-tip-${event.id}`} data-tooltip-html={toolTipTitle}
      >
        <div
          className={cn(
            'flex flex-col w-full',
            // Note: at this time, css for arrow is same as arrow-start
            month && event.multiday && DateTimeHelpers.isSameDay(event.start, day) && 'arrow-start p-0',
            month && event.multiday && !DateTimeHelpers.isSameDay(event.start, day) && !DateTimeHelpers.isSameDay(event.end, day) && 'arrow p-0',
            month && event.multiday && DateTimeHelpers.isSameDay(event.end, day) && 'arrow-end p-0',
            month && event.multiday && event.type,
            month && 'flex-row items-center justify-between pl-1'
          )}
        >
          <p className={cn(month && 'truncate text-xs', 'm-0')}>
            {event.title}
          </p>
        </div>
      </div>
      <Tooltip
        delay={550}
        id={`title-tip-${event.id}`}
        position='right'
      />
    </>
  )
}
