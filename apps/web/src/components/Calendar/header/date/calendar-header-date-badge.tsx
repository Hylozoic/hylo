import React from 'react'
import { useCalendarContext } from '../../calendar-context'
import { sameMonth } from '../../calendar-util'
import { useTranslation } from 'react-i18next'

export default function CalendarHeaderDateBadge () {
  const { events, date } = useCalendarContext()
  const monthEvents = events.filter((event) => sameMonth(event.start, date))
  const { t } = useTranslation()

  return (
    <div className='whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs'>
      {monthEvents.length === 0 ? t('No events') : t('eventCount', { count: monthEvents.length })}
    </div>
  )
}
