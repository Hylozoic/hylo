import React from 'react'
import { Button } from '@/components/ui/button'
import { useCalendarContext } from '../../calendar-context'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DateTime } from 'luxon'

export default function CalendarHeaderDateChevrons () {
  const { mode, date, setDate } = useCalendarContext()
  const luxonDate = DateTime.fromJSDate(date)
  const dateFormat = mode === 'day'
    ? {
        month: 'long' as const,
        day: 'numeric' as const,
        year: 'numeric' as const
      }
    : {
        month: 'long' as const,
        year: 'numeric' as const
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
        {DateTime.fromJSDate(date).toLocaleString(dateFormat)}
      </span>

      <Button
        variant='outline'
        className='h-7 w-7 p-1'
        onClick={handleDateForward}
      >
        <ChevronRight className='min-w-5 min-h-5' />
      </Button>
    </div>
  )
}
