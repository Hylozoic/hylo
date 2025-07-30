import React from 'react'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { useCalendarContext } from '../../calendar-context'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DateTime } from 'luxon'
import { Mode } from '../../calendar-types'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'

const formatDate = (luxonDate: DateTime, mode: Mode) => {
  const weekStart = luxonDate.startOf('week', { useLocaleWeeks: true })
  const weekEnd = luxonDate.endOf('week', { useLocaleWeeks: true })
  const isSameMonth = weekStart.hasSame(weekEnd, 'month')
  switch (mode) {
    case 'day':
      return luxonDate.toLocaleString({
        month: 'long' as const,
        day: 'numeric' as const,
        year: 'numeric' as const
      })
    case 'week':
      return `${(isSameMonth
        ? weekStart.toFormat('LLLL d')
        : weekStart.toFormat('LLL d')
      )}\u2013${isSameMonth
        ? weekEnd.toFormat('d, yyyy')
        : weekEnd.toFormat('LLL d, yyyy')
        }`
    default:
      return luxonDate.toLocaleString({
        month: 'long' as const,
        year: 'numeric' as const
      })
  }
}

export default function CalendarHeaderDateChevrons () {
  const { t } = useTranslation()
  const { mode, date, setDate } = useCalendarContext()
  const luxonDate = DateTimeHelpers.toDateTime(date, { locale: getLocaleFromLocalStorage() })
  const today = new Date()

  const shouldHideGoToButton = () => {
    switch (mode) {
      case 'month':
        return DateTimeHelpers.isSameMonth(date, today)
      case 'week':
        return DateTimeHelpers.isSameWeek(date, today)
      case 'day':
        return DateTimeHelpers.isSameDay(date, today)
    }
  }

  const goToButtonText = () => {
    switch (mode) {
      case 'month':
        return t('Go to This Month')
      case 'week':
        return t('Go to This Week')
      case 'day':
        return t('Go to Today')
    }
  }

  const handleDateBackward = () => {
    switch (mode) {
      case 'month':
        setDate(luxonDate.minus({ months: 1 }).toJSDate())
        break
      case 'week':
        setDate(luxonDate.minus({ weeks: 1 }).toJSDate())
        break
      case 'day':
        setDate(luxonDate.minus({ days: 1 }).toJSDate())
        break
    }
  }

  const handleDateForward = () => {
    switch (mode) {
      case 'month':
        setDate(luxonDate.plus({ months: 1 }).toJSDate())
        break
      case 'week':
        setDate(luxonDate.plus({ weeks: 1 }).toJSDate())
        break
      case 'day':
        setDate(luxonDate.plus({ days: 1 }).toJSDate())
        break
    }
  }

  return (
    <div className='flex items-center gap-2'>
      <Button
        variant='outline'
        className='h-7 w-7 p-1'
        onClick={handleDateBackward}
      >
        <ChevronLeft className='min-w-5 min-h-5' />
      </Button>

      <span className='min-w-[140px] text-center font-medium'>
        {formatDate(luxonDate, mode)}
      </span>

      <Button
        variant='outline'
        className='h-7 w-7 p-1'
        onClick={handleDateForward}
      >
        <ChevronRight className='min-w-5 min-h-5' />
      </Button>

      {!shouldHideGoToButton() &&
        <Button
          variant='outline'
          className='h-7 p-3'
          onClick={() => setDate(today)}
        >
          {goToButtonText()}
        </Button>}
    </div>
  )
}
