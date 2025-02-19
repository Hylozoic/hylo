import React from 'react'
import { useCalendarContext } from '../../calendar-context'
import { sameDay } from '../../calendar-util'
import { hours } from './calendar-body-margin-day-margin'
import CalendarBodyHeader from '../calendar-body-header'
import CalendarEvent from '../../calendar-event'

export default function CalendarBodyDayContent ({ date }: { date: Date }) {
  const { events } = useCalendarContext()

  const dayEvents = events.filter((event) => sameDay(event.start, date, event.end))

  return (
    <div className='flex flex-col flex-grow'>
      <CalendarBodyHeader date={date} />

      <div className='flex-1 relative'>
        {hours.map((hour) => (
          <div key={hour} className='h-32 border-b border-border/50 group' />
        ))}

        {dayEvents.map((event) => (
          <CalendarEvent key={event.id} event={event} day={date} />
        ))}
      </div>
    </div>
  )
}
