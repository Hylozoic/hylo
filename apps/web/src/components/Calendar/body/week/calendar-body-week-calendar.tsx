import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCalendarContext } from '../../calendar-context'
import { Calendar } from '@/components/ui/calendar'
import { Interval } from 'luxon'
import { eachIntervalDay } from '../../calendar-util'
import { toDateTime, sameWeek, includes } from '@hylo/shared/src/DateTimeHelper'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'

const selectedWeekDates = function (date: Date) {
  const luxonDate = toDateTime(date)
  // Get the first day of the week
  const weekStart = luxonDate.startOf('week', { useLocaleWeeks: true })
  // Get the last day of the week
  const weekEnd = luxonDate.endOf('week', { useLocaleWeeks: true }).plus({ day: 1 })
  // Get all days between start and end
  const interval = Interval.fromDateTimes(weekStart, weekEnd)
  return eachIntervalDay(interval)
}

export default function CalendarBodyWeekCalendar () {
  const { t } = useTranslation()
  const { date, events, setDate } = useCalendarContext()
  const today = new Date()

  const [hideGoToButton, setHideGoToButton] = useState(sameWeek(date, today))
  const [selected, setSelected] = useState<Date[]>(selectedWeekDates(date))
  const [month, setMonth] = useState(date)

  const handleDayClick = (day: Date) => {
    setSelected(selectedWeekDates(day))
    setDate(day)
  }

  const handleMonthChange = (day : Date) => {
    setDate(day)
    setMonth(day)
    setHideGoToButton(sameWeek(day, today))
  }

  const handleGoToButton = () => {
    handleMonthChange(today)
    setSelected(selectedWeekDates(today))
    setDate(today)
  }

  return (
    <>
      <Calendar
        month={month}
        selected={selected}
        onDayClick={handleDayClick}
        onMonthChange={handleMonthChange}
        mode='multiple'
        classNames={{
          // align formatted days vertically at top of cells, allow to wrap, and reduce lineheight
          day: 'whitespace-pre-wrap h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-selected/50 [&:has([aria-selected])]:bg-selected first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 rounded-1',
          day_button: cn(buttonVariants({ variant: 'ghost' }), 'whitespace-pre-wrap leading-3 items-start h-9 w-9 font-normal aria-selected:opacity-100 rounded-l-md rounded-r-md')
        }}
        formatters={({
          formatDay: (date, options) => {
            const maxNumEvents = 3
            const numEvents = events.filter((event) => includes(event.start, date, event.end)).length
            const symbols = '•'.repeat(Math.min(numEvents, maxNumEvents))
            const moreSymbol = numEvents > maxNumEvents
            return `${toDateTime(date).toFormat('dd', { locale: options.locale.code })}\n${symbols}${moreSymbol ? '+' : ''}`
          }
        })}
      />
      {!hideGoToButton &&
        <Button
          variant='outline'
          className='h-7'
          onClick={() => handleGoToButton()}
        >
          {t('Go to This Week')}
        </Button>}
    </>
  )
}
