import React, { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { postUrl } from 'util/navigation'
import { useCalendarContext } from 'components/Calendar/calendar-context'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { CalendarEvent as CalendarEventType } from 'components/Calendar/calendar-types'
import Tooltip from 'components/Tooltip'

import classes from '../../calendar.module.scss'

export default function CalendarBodyDayEvent ({
  event
} : {
  event: CalendarEventType
}) {
  const { routeParams, locationParams, querystringParams } =
    useCalendarContext()
  const navigate = useNavigate()
  const showDetails = useCallback(() => {
    navigate(postUrl(event.id, routeParams, { ...locationParams, ...querystringParams }))
  }, [event.id, routeParams, locationParams, querystringParams])
  // TODO format for multi-day events
  const toolTipTitle = `${event.title}<br />${format(event.start, 'h:mm a')} - ${format(event.end, 'h:mm a')}`

  return (
    <div
      className={cn(
        classes[event.type],
        'flex items-center gap-2 px-2 cursor-pointer rounded-md border-2'
      )}
      onClick={showDetails}
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
