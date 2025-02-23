import React from 'react'
import { useCalendarContext } from '../../calendar-context'
import { includes } from '../../calendar-util'
import CalendarBodyDayEvent from './calendar-body-day-event'

export default function CalendarBodyDayEvents () {
  const { events, date } =
    useCalendarContext()
  const dayEvents = events.filter((event) => includes(event.start, date, event.end))

  return (
    dayEvents.length > 0
      ? (
        <div className='flex flex-col gap-2'>
          <p className='font-medium p-2 pb-0 font-heading'>Events</p>
          <div className='flex flex-col gap-2'>
            {dayEvents.map((event) => (
              <CalendarBodyDayEvent key={event.id} event={event} />
            ))}
          </div>
        </div>
        )
      : <div className='p-2 text-muted-foreground'>No events today...</div>
  )
}
