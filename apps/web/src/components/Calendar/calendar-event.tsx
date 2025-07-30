import React from 'react'
import { CalendarEvent as CalendarEventType } from 'components/Calendar/calendar-types'
import { useCalendarContext } from 'components/Calendar/calendar-context'
import { DateTime, Interval } from 'luxon'
import { motion, MotionConfig, AnimatePresence } from 'framer-motion'
import Tooltip from 'components/Tooltip'
import { DateTimeHelpers } from '@hylo/shared'
import useViewPostDetails from 'hooks/useViewPostDetails'
import { cn } from 'util/index'
import { getLocaleFromLocalStorage } from 'util/locale'

import classes from './calendar.module.scss'

interface EventPosition {
  left: string
  width: string
  top: string
  height: string
}

function getOverlappingEvents (
  currentEvent: CalendarEventType,
  events: CalendarEventType[]
): CalendarEventType[] {
  const dt1 = DateTimeHelpers.toDateTime(currentEvent.start, { locale: getLocaleFromLocalStorage() })
  return events.filter((event) => {
    if (event.id === currentEvent.id) return true
    const dt2 = DateTimeHelpers.toDateTime(event.start, { locale: getLocaleFromLocalStorage() })
    const interval = Interval.fromDateTimes(dt1, dt2)
    return Math.abs(interval.length('minutes')) <= 15
  })
}

function calculateEventPosition (
  event: CalendarEventType,
  allEvents: CalendarEventType[],
  day: Date
): EventPosition {
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
}: {
  event: CalendarEventType
  month?: boolean
  className?: string
  day?: Date
}) {
  const { events, date } =
    useCalendarContext()
  const style = month ? {} : calculateEventPosition(event, events, day)
  // TODO format for multi-day events
  const timeFormat = { ...DateTime.TIME_SIMPLE, timeZoneName: 'short' as const }
  const toolTipTitle = `${event.title}<br />${DateTimeHelpers.toDateTime(event.start, { locale: getLocaleFromLocalStorage() }).toLocaleString(timeFormat)} - ${DateTimeHelpers.toDateTime(event.end, { locale: getLocaleFromLocalStorage() }).toLocaleString(timeFormat)}`

  const viewPostDetails = useViewPostDetails()

  // Generate a unique key that includes the current month to prevent animation conflicts
  const isEventInCurrentMonth = DateTimeHelpers.isSameMonth(event.start, date)
  const animationKey = `${event.id}-${
    isEventInCurrentMonth ? 'current' : 'adjacent'
  }`

  return (
    <MotionConfig reducedMotion='user'>
      <AnimatePresence mode='wait'>
        <motion.div
          className={cn(
            classes[event.type],
            'cursor-pointer transition-all duration-300 border',
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
          initial={{
            opacity: 0,
            y: -3,
            scale: 0.98
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1
          }}
          exit={{
            opacity: 0,
            scale: 0.98,
            transition: {
              duration: 0.15,
              ease: 'easeOut'
            }
          }}
          transition={{
            duration: 0.2,
            ease: [0.25, 0.1, 0.25, 1],
            opacity: {
              duration: 0.2,
              ease: 'linear'
            },
            layout: {
              duration: 0.2,
              ease: 'easeOut'
            }
          }}
          layoutId={`event-${animationKey}-${month ? 'month' : 'day'}`}
        >
          <motion.div
            className={cn(
              'flex flex-col w-full',
              // Note: at this time, css for arrow is same as arrow-start
              month && event.multiday && DateTimeHelpers.isSameDay(event.start, day) && 'arrow-start p-0',
              month && event.multiday && !DateTimeHelpers.isSameDay(event.start, day) && !DateTimeHelpers.isSameDay(event.end, day) && 'arrow p-0',
              month && event.multiday && DateTimeHelpers.isSameDay(event.end, day) && 'arrow-end p-0',
              month && event.multiday && event.type,
              month && 'flex-row items-center justify-between pl-1'
            )}
            layout='position'
          >
            <p className={cn(month && 'truncate text-xs', 'm-0')}>
              {event.title}
            </p>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      <Tooltip
        delay={550}
        id={`title-tip-${event.id}`}
        position='right'
      />
    </MotionConfig>
  )
}
