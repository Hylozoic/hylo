import React from 'react'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'

export default function EventDate ({ startTime }) {
  if (!startTime) return null
  const start = DateTimeHelpers.toDateTime(startTime, { locale: getLocaleFromLocalStorage() })
  return (
    <div className='w-16 h-16 flex items-center flex-col justify-center bg-white rounded-lg'>
      <div className='bg-error text-white rounded-t-md h-1/2 w-full uppercase items-center justify-center flex font-bold text-lg'>{start.toFormat('MMM')}</div>
      <div className='bg-white text-black border-b-2 border-l-2 border-r-2 border-error/20 rounded-b-md h-1/2 w-full uppercase items-center justify-center flex font-bold text-2xl'>{start.toFormat('d')}</div>
    </div>
  )
}
