import React from 'react'
import { useCalendarContext } from '../../calendar-context'
import { Calendar } from '@/components/ui/calendar'
import { format, isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export default function CalendarBodyDayCalendar () {
  const { date, events, setDate } = useCalendarContext()
  return (
    <Calendar
      selected={date}
      onSelect={(date: Date | undefined) => date && setDate(date)}
      mode='single'
      classNames={{
        // align formatted days vertically at top of cells, allow to wrap, and reduce lineheight
        day: 'whitespace-pre-wrap h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-selected/50 [&:has([aria-selected])]:bg-selected first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 rounded-1',
        day_button: cn(buttonVariants({ variant: 'ghost' }), 'whitespace-pre-wrap leading-3 items-start h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-l-md rounded-r-md')
      }}
      formatters={({
        formatDay: (date, options) => {
          const numEvents = events.filter((event) => isSameDay(event.start, date)).length
          const symbols = '•'.repeat(Math.min(numEvents, 3))
          return `${format(date, 'dd', options)}\n${symbols}`
        }
      })}
    />
  )
}
