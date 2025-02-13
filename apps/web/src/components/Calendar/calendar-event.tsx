import React, { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { CalendarEvent as CalendarEventType } from 'components/Calendar/calendar-types'
import { postUrl } from 'util/navigation'
import { useCalendarContext } from 'components/Calendar/calendar-context'
import { DateTime } from 'luxon'
import { cn } from '@/lib/utils'
import { motion, MotionConfig, AnimatePresence } from 'framer-motion'
import Tooltip from 'components/Tooltip'
import { sameDay, sameMonth } from './calendar-util'

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
  return events.filter((event) => {
    if (event.id === currentEvent.id) return false
    return (
      currentEvent.start < event.end &&
      currentEvent.end > event.start &&
      sameDay(currentEvent.start, event.start)
    )
  })
}

function calculateEventPosition (
  event: CalendarEventType,
  allEvents: CalendarEventType[]
): EventPosition {
  const overlappingEvents = getOverlappingEvents(event, allEvents)
  const group = [event, ...overlappingEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  )
  const position = group.indexOf(event)
  const width = `${100 / (overlappingEvents.length + 1)}%`
  const left = `${(position * 100) / (overlappingEvents.length + 1)}%`

  const startHour = event.start.getHours()
  const startMinutes = event.start.getMinutes()

  let endHour = event.end.getHours()
  let endMinutes = event.end.getMinutes()

  if (!sameDay(event.start, event.end)) {
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
  className
}: {
  event: CalendarEventType
  month?: boolean
  className?: string
}) {
  const { events, date, routeParams, locationParams, querystringParams } =
    useCalendarContext()
  const style = month ? {} : calculateEventPosition(event, events)
  // TODO format for multi-day events
  const timeFormat = { ...DateTime.TIME_SIMPLE, timeZoneName: 'short' as const }
  const toolTipTitle = `${event.title}<br />${DateTime.fromJSDate(event.start).toLocaleString(timeFormat)} - ${DateTime.fromJSDate(event.end).toLocaleString(timeFormat)}`

  // our custon event click handler
  const navigate = useNavigate()
  const showDetails = useCallback(() => {
    navigate(postUrl(event.id, routeParams, { ...locationParams, ...querystringParams }))
  }, [event.id, routeParams, locationParams, querystringParams])

  // Generate a unique key that includes the current month to prevent animation conflicts
  const isEventInCurrentMonth = sameMonth(event.start, date)
  const animationKey = `${event.id}-${
    isEventInCurrentMonth ? 'current' : 'adjacent'
  }`

  return (
    <MotionConfig reducedMotion='user'>
      <AnimatePresence mode='wait'>
        <motion.div
          className={cn(
            classes[event.type],
            'px-0 py-0 rounded-md truncate cursor-pointer transition-all duration-300 border',
            !month && 'absolute',
            className
          )}
          style={style}
          onClick={(e) => {
            e.stopPropagation()
            showDetails()
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
              month && 'flex-row items-center justify-between'
            )}
            layout='position'
          >
            <p className={cn('font-bold truncate', month && 'text-xs', 'm-0')}>
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
