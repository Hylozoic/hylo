import React from 'react'
import CalendarHeaderDateChevrons from './calendar-header-date-chevrons'
import CalendarHeaderDateBadge from './calendar-header-date-badge'

export default function CalendarHeaderDate () {
  return (
    <div className='flex items-center gap-2'>
      <div>
        <div className='flex items-center gap-1'>
          <CalendarHeaderDateBadge />
        </div>
        <CalendarHeaderDateChevrons />
      </div>
    </div>
  )
}
