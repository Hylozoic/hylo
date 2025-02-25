import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useCalendarContext } from '../../calendar-context'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DateTime } from 'luxon'
import { Mode } from '../../calendar-types'
import { sameMonth } from '../../calendar-util'

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
        ? weekStart.toLocaleString({
          month: 'long' as const,
          day: 'numeric' as const
        })
        : weekStart.toLocaleString({
          month: 'short' as const,
          day: 'numeric' as const
        }))}\u2013${isSameMonth
        ? weekEnd.toFormat('d, yyyy')
        : weekEnd.toLocaleString({
          month: 'short' as const,
          day: 'numeric' as const,
          year: 'numeric' as const
        })}`
    default:
      return luxonDate.toLocaleString({
        month: 'long' as const,
        year: 'numeric' as const
      })
  }
}

export default function CalendarHeaderDateChevrons () {
  const { mode, date, setDate } = useCalendarContext()
  const luxonDate = DateTime.fromJSDate(date)
  const today = new Date()

  const goToButton = () => {
    setDate(today)
    setHideGoToButton(true)
  }

  const goToButtonText = () => {
    switch (mode) {
      case 'month':
        return 'Go To This Month'
      case 'week':
        return 'Go To This Week'
      case 'day':
        return 'Go To Today'
    }
  }

  const [hideGoToButton, setHideGoToButton] = useState(sameMonth(date, today))
  const [goToText, setGoToText] = useState(goToButtonText())

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
    setHideGoToButton(sameMonth(date, today))
    setGoToText(goToButtonText())
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
    setHideGoToButton(sameMonth(date, today))
    setGoToText(goToButtonText())
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

      {!hideGoToButton &&
        <Button
          variant='outline'
          className='h-7 p-3'
          onClick={() => goToButton()}
        >
          {goToText}
        </Button>}
    </div>
  )
}
