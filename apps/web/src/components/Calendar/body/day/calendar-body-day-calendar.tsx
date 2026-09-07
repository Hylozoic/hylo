import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCalendarContext } from '../../calendar-context'
import { Calendar } from '@/components/ui/calendar'
import { DateTimeHelpers } from '@hylo/shared'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'

export default function CalendarBodyDayCalendar () {
  const { t } = useTranslation()
  const today = new Date()
  const { date, events, setDate } = useCalendarContext()
  const hideGoToButton = DateTimeHelpers.isSameDay(date, today)

  return (
    <div className={cn('w-full')}>
      <Calendar
        month={date}
        selected={date}
        onSelect={(day : Date | undefined) => day && setDate(day)}
        onMonthChange={setDate}
        mode='single'
        classNames={{
          // align formatted days vertically at top of cells, allow to wrap, and reduce lineheight
          day: 'whitespace-pre-wrap size-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-selected/50 [&:has([aria-selected])]:bg-selected first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 rounded-1',
          day_button: cn(buttonVariants({ variant: 'ghost' }), 'whitespace-pre-wrap leading-3 items-start size-9 font-normal aria-selected:opacity-100 rounded-l-md rounded-r-md')
        }}
        formatters={({
          formatDay: (day, options) => {
            const maxNumEvents = 3
            const numEvents = (events ?? []).filter((event) => DateTimeHelpers.rangeIncludesDate(event.start, day, event.end)).length
            const symbols = '•'.repeat(Math.min(numEvents, maxNumEvents))
            const moreSymbol = numEvents > maxNumEvents
            const locale = options?.locale?.code
            return `${DateTimeHelpers.toDateTime(day, { locale }).toFormat('dd', { locale })}\n${symbols}${moreSymbol ? '+' : ''}`
          }
        })}
      />
      {!hideGoToButton &&
        <Button
          variant='outline'
          className='h-7'
          onClick={() => setDate(today)}
        >
          {t('Go to Today')}
        </Button>}
    </div>
  )
}
