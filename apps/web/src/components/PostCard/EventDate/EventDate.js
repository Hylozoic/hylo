import React from 'react'
import { DateTime } from 'luxon'
import classes from './EventDate.module.scss'

export default function EventDate ({ startTime }) {
  if (!startTime) return null
  const start = DateTime.fromISO(startTime)
  return (
    <div className='w-16 h-16 flex items-center flex-col justify-center bg-white rounded-lg'>
      <div className='bg-error text-white rounded-t-lg h-1/2 w-full uppercase items-center justify-center flex font-bold text-lg'>{start.toFormat('MMM')}</div>
      <div className='bg-white text-black rounded-b-lg h-1/2 w-full uppercase items-center justify-center flex font-bold text-2xl'>{start.toFormat('d')}</div>
    </div>
  )
}
