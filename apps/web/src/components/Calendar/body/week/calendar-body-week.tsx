import React from 'react'
import { useCalendarContext } from '../../calendar-context'
import { DateTime } from 'luxon'
import CalendarBodyMarginDayMargin from '../day/calendar-body-margin-day-margin'
import CalendarBodyDayContent from '../day/calendar-body-day-content'
export default function CalendarBodyWeek () {
  const { date } = useCalendarContext()

  const weekStart = DateTime.fromJSDate(date).startOf('week', { useLocaleWeeks: true })
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.plus({ day: i }))

  return (
    <div className='flex divide-x flex-grow overflow-hidden'>
      <div className='flex flex-col flex-grow divide-y overflow-hidden'>
        <div className='flex flex-col flex-1 overflow-y-auto'>
          <div className='relative flex flex-1 divide-x flex-col md:flex-row'>
            <CalendarBodyMarginDayMargin className='hidden md:block' />
            {weekDays.map((day) => (
              <div
                key={day.toISO()}
                className='flex flex-1 divide-x md:divide-x-0'
              >
                <CalendarBodyMarginDayMargin className='block md:hidden' />
                <CalendarBodyDayContent date={day.toJSDate()} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
