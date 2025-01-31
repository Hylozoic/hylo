import React from 'react'
import CalendarHeaderDateIcon from './calendar-header-date-icon'
import CalendarHeaderDateChevrons from './calendar-header-date-chevrons'
import CalendarHeaderDateBadge from './calendar-header-date-badge'

export default function CalendarHeaderDate () {
  return (
    <div className='flex items-center gap-2'>
      <CalendarHeaderDateIcon />
      <div>
        <div className='flex items-center gap-1'>
          <CalendarHeaderDateBadge />
        </div>
        <CalendarHeaderDateChevrons />
      </div>
    </div>
  )
}
