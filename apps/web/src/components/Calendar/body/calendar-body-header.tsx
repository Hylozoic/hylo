import React from 'react'
import { format, isSameDay } from 'date-fns'
import { cn } from '../../../lib/utils'

export default function CalendarBodyHeader ({
  date,
  onlyDay = false
}: {
  date: Date
  onlyDay?: boolean
}) {
  const isToday = isSameDay(date, new Date())

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1 py-2 w-full sticky top-0 bg-background z-10 border-b',
        isToday ? 'bg-black' : 'bg-background'
      )}
    >
      <span
        className={cn(
          'text-xs font-medium',
          isToday ? 'text-white font-bold bg-black' : 'text-muted-foreground'
        )}
      >
        {format(date, 'EEE')}
      </span>
      {!onlyDay && (
        <span
          className={cn(
            'text-xs font-medium',
            isToday ? 'text-white font-bold bg-black' : 'text-foreground'
          )}
        >
          {format(date, 'dd')}
        </span>
      )}
    </div>
  )
}
