import React from 'react'
import { useCalendarContext } from '../../calendar-context'
import { DateTime, Interval } from 'luxon'
import { cn } from '@/lib/utils'
import CalendarEvent from '../../calendar-event'
import { AnimatePresence, motion } from 'framer-motion'
import { eachIntervalDay, sameDay, sameMonth } from '../../calendar-util'

export default function CalendarBodyMonth () {
  const { date, events, setDate, setMode } = useCalendarContext()
  const luxonDate = DateTime.fromJSDate(date)
  const maxEventsPerDay = 3

  // Get the first day of the month
  const monthStart = luxonDate.startOf('month')
  // Get the last day of the month
  const monthEnd = luxonDate.endOf('month')

  // Get the first Monday of the first week (may be in previous month)
  const calendarStart = monthStart.startOf('week', { useLocaleWeeks: true })
  // Get the last Sunday of the last week (may be in next month)
  const calendarEnd = monthEnd.endOf('week', { useLocaleWeeks: true })

  // Get all days between start and end

  const interval = Interval.fromDateTimes(calendarStart, calendarEnd)
  const calendarDays = eachIntervalDay(interval)
  const today = new Date()

  // Filter events to only show those within the current month view
  const visibleEvents = events.filter(
    (event) =>
      interval.contains(DateTime.fromJSDate(event.start)) ||
      interval.contains(DateTime.fromJSDate(event.end))
  )

  return (
    <div className='flex flex-col flex-grow overflow-hidden'>
      <div className='hidden md:grid grid-cols-7 border-border divide-x divide-border'>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div
            key={day}
            className='py-2 text-center text-sm font-medium text-muted-foreground border-b border-border'
          >
            {day}
          </div>
        ))}
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
              sameDay(event.start, day)
            )
            const isToday = sameDay(day, today)
            const isCurrentMonth = sameMonth(day, date)

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
                    'text-sm font-medium w-fit p-1 flex flex-col items-center justify-center rounded-full aspect-square',
                    isToday && isCurrentMonth && 'bg-black text-white',
                    isToday && !isCurrentMonth && 'bg-black/50 text-white',
                    !isToday && !isCurrentMonth && 'text-gray-600/50'
                  )}
                >
                  {DateTime.fromJSDate(day).toFormat('d')}
                </div>
                <AnimatePresence mode='wait'>
                  <div className='flex flex-col gap-1 mt-1'>
                    {dayEvents.slice(0, maxEventsPerDay).map((event) => (
                      <CalendarEvent
                        key={event.id}
                        event={event}
                        className='relative h-auto'
                        month
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
                        className='text-xs text-muted-foreground'
                        onClick={(e) => {
                          e.stopPropagation()
                          setDate(day)
                          setMode('day')
                        }}
                      >
                        +{dayEvents.length - maxEventsPerDay} more...
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
  )
}
