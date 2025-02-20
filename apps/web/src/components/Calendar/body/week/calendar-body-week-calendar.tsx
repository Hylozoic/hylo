import React, { useState } from 'react'
import { useCalendarContext } from '../../calendar-context'
import { Calendar } from '@/components/ui/calendar'
import { DateTime, Interval } from 'luxon'
import { includes, eachIntervalDay } from '../../calendar-util'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const selectedWeekDates = function (date: Date) {
  const luxonDate = DateTime.fromJSDate(date)
  // Get the first day of the week
  const weekStart = luxonDate.startOf('week', { useLocaleWeeks: true })
  // Get the last day of the week
  const weekEnd = luxonDate.endOf('week', { useLocaleWeeks: true }).plus({ day: 1 })
  // Get all days between start and end
  const interval = Interval.fromDateTimes(weekStart, weekEnd)
  return eachIntervalDay(interval)
}

export default function CalendarBodyWeekCalendar () {
  const { date, events, setDate } = useCalendarContext()
  const [selected, setSelected] = useState<Date[] | undefined>(selectedWeekDates(date))

  const handleDayClick = (day: Date) => {
    setDate(day)
    setSelected(selectedWeekDates(day))
  }

  return (
    <Calendar
      selected={selected}
      onDayClick={handleDayClick}
      mode='multiple'
      classNames={{
        // align formatted days vertically at top of cells, allow to wrap, and reduce lineheight
        day: 'whitespace-pre-wrap h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-selected/50 [&:has([aria-selected])]:bg-selected first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 rounded-1',
        day_button: cn(buttonVariants({ variant: 'ghost' }), 'whitespace-pre-wrap leading-3 items-start h-9 w-9 font-normal aria-selected:opacity-100 rounded-l-md rounded-r-md')
      }}
      formatters={({
        formatDay: (date, options) => {
          const numEvents = events.filter((event) => includes(event.start, date, event.end)).length
          const symbols = '•'.repeat(Math.min(numEvents, 3))
          return `${DateTime.fromJSDate(date).toFormat('dd', { locale: options.locale.code })}\n${symbols}`
        }
      })}
    />
  )
}
