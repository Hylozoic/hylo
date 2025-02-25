import React, { useState } from 'react'
import { useCalendarContext } from '../../calendar-context'
import { Calendar } from '@/components/ui/calendar'
import { DateTime } from 'luxon'
import { includes, sameDay } from '../../calendar-util'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'

export default function CalendarBodyDayCalendar () {
  const today = new Date()
  const { date, events, setDate } = useCalendarContext()

  const [hideGoToToday, setHideGoToToday] = useState(sameDay(date, today))
  const [selected, setSelected] = useState<Date>(date)
  const [month, setMonth] = useState(date)

  const handleMonthChange = (day : Date) => {
    setHideGoToToday(sameDay(day, today))
    setMonth(day)
    setDate(day)
  }

  const goToToday = () => {
    handleMonthChange(today)
    setSelected(today)
    setDate(today)
  }

  return (
    <>
      <Calendar
        month={month}
        selected={selected}
        onSelect={(day : Date | undefined) => day && setDate(day)}
        onMonthChange={handleMonthChange}
        mode='single'
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
      {!hideGoToToday &&
        <Button
          variant='outline'
          className='h-7'
          onClick={() => goToToday()}
        >
          Go to Today
        </Button>}
    </>
  )
}
