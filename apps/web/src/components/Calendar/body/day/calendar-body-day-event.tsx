import React, { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { postUrl } from 'util/navigation'
import { useCalendarContext } from 'components/Calendar/calendar-context'
import { format } from 'date-fns'
import { CalendarEvent as CalendarEventType } from 'components/Calendar/calendar-types'
import Tooltip from 'components/Tooltip'

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
      className='flex items-center gap-2 px-2 cursor-pointer'
      onClick={showDetails}
      data-tooltip-id={`title-tip-${event.id}`} data-tooltip-html={toolTipTitle}
    >
      <div className='flex items-center gap-2'>
        <div className={`size-2 rounded-full bg-${event.color}-500`} />
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
