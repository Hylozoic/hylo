import React from 'react'
import { useTranslation } from 'react-i18next'
import { useCalendarContext } from '../../calendar-context'
import { Interval, Info } from 'luxon'
import { DateTimeHelpers } from '@hylo/shared'
import { cn } from '@/lib/utils'
import CalendarEvent from '../../calendar-event'
import { AnimatePresence, motion } from 'framer-motion'
import { eachIntervalDay } from '../../calendar-util'

export default function CalendarBodyMonth () {
  const { t } = useTranslation()
  const { date, events, setDate, setMode } = useCalendarContext()
  const luxonDate = DateTimeHelpers.toDateTime(date)
  const maxEventsPerDay = 3

  // Get the first day of the month
  const monthStart = luxonDate.startOf('month')
  // Get the last day of the month
  const monthEnd = luxonDate.endOf('month')

  // Get the first Monday of the first week (may be in previous month)
  const calendarStart = monthStart.startOf('week', { useLocaleWeeks: true })
  // Get the last Sunday of the last week (may be in next month)
  const calendarEnd = monthEnd.endOf('week', { useLocaleWeeks: true }).plus({ day: 1 })

  // Get all days between start and end

  const interval = Interval.fromDateTimes(calendarStart, calendarEnd)
  const calendarDays = eachIntervalDay(interval)
  const today = new Date()

  // Filter events to only show those within the current month view
  const visibleEvents = events.filter(
    (event) =>
      interval.contains(DateTimeHelpers.toDateTime(event.start)) ||
      interval.contains(DateTimeHelpers.toDateTime(event.end))
  ).sort(
    (a, b) => a.multiday && !b.multiday ? -1 : a.start.getTime() - b.start.getTime()
  )

  return (
    <>
      <div className='flex flex-col flex-grow overflow-hidden'>
        <div className='hidden md:grid grid-cols-7 border-border divide-x divide-border'>
          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
            const luxonDay = (day + 6) % 7
            const dayName = Info.weekdays('short', { locale: DateTimeHelpers.getLocaleAsString() })[luxonDay]
            return (
              <div
                key={dayName}
                className='py-2 text-center text-sm font-medium text-muted-foreground border-b border-border'
              >
                {dayName}
              </div>
            )
          })}
        </div>

        <AnimatePresence mode='wait' initial={false}>
          <motion.div
            key={monthStart.toISO()}
            className='grid md:grid-cols-7 flex-grow overflow-y-auto relative'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.2,
              ease: 'easeInOut'
            }}
          >
            {calendarDays.map((day) => {
              const dayEvents = visibleEvents.filter((event) =>
                DateTimeHelpers.includes(event.start, day, event.end)
              )
              const isToday = DateTimeHelpers.sameDay(day, today)
              const isCurrentMonth = DateTimeHelpers.sameMonth(day, date)

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'relative flex flex-col border-b border-r px-1 py-0 aspect-square cursor-pointer',
                    !isCurrentMonth && 'bg-muted hidden md:flex'
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    setDate(day)
                    setMode('day')
                  }}
                >
                  <div
                    className={cn(
                      'text-sm font-medium w-fit p-1 m-1 items-center justify-center flex flex-col rounded-md aspect-square',
                      isToday && isCurrentMonth && 'bg-gray-400 text-white',
                      isToday && !isCurrentMonth && 'bg-gray/200 text-white',
                      !isToday && !isCurrentMonth && 'text-gray-600/50'
                    )}
                  >
                    {DateTimeHelpers.toDateTime(day).toFormat('d')}
                  </div>
                  <AnimatePresence mode='wait'>
                    <div className='flex flex-col gap-1'>
                      {dayEvents.slice(0, maxEventsPerDay).map((event) => (
                        <CalendarEvent
                          key={event.id}
                          event={event}
                          className='relative h-auto'
                          month
                          day={day}
                        />
                      ))}
                      {dayEvents.length > maxEventsPerDay && (
                        <motion.div
                          key={`more-${day.toISOString()}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            duration: 0.2
                          }}
                          className='text-xs text-muted-foreground leading-none'
                          onClick={(e) => {
                            e.stopPropagation()
                            setDate(day)
                            setMode('day')
                          }}
                        >
                          {`+${dayEvents.length - maxEventsPerDay} ${t('more')}...`}
                        </motion.div>
                      )}
                    </div>
                  </AnimatePresence>
                </div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}
