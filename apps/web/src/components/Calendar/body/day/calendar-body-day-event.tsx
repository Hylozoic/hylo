import React from 'react'
import { DateTime } from 'luxon'
import { cn } from '@/lib/utils'
import { CalendarEvent as CalendarEventType } from 'components/Calendar/calendar-types'
import Tooltip from 'components/Tooltip'
import useViewPostDetails from 'hooks/useViewPostDetails'

import classes from '../../calendar.module.scss'

export default function CalendarBodyDayEvent ({
  event
} : {
  event: CalendarEventType
}) {
  const viewPostDetails = useViewPostDetails()

  // TODO format for multi-day events
  const timeFormat = { ...DateTime.TIME_SIMPLE, timeZoneName: 'short' as const }
  const toolTipTitle = `${event.title}<br />${DateTime.fromJSDate(event.start).toLocaleString(timeFormat)} - ${DateTime.fromJSDate(event.end).toLocaleString(timeFormat)}`

  return (
    <div
      className={cn(
        classes[event.type],
        'flex items-center gap-2 px-2 cursor-pointer rounded-md border-2'
      )}
      onClick={() => viewPostDetails(event.id)}
      data-tooltip-id={`title-tip-${event.id}`} data-tooltip-html={toolTipTitle}
    >
      <div className='flex items-center gap-2'>
        <div className='size-2 rounded-full' />
        <p className='text-muted-foreground text-sm font-medium'>
          {event.title}
        </p>
      </div>
      <Tooltip
        delay={550}
        id={`eventToolTip-${event.id}`}
        position='right'
      />
    </div>
  )
}
