import React from 'react'
import { DateTime } from 'luxon'
import classes from './EventDate.module.scss'

export default function EventDate ({ startTime }) {
  if (!startTime) return null
  const start = DateTime.fromJSDate(startTime)
  return (
    <div className={classes.eventDate}>
      <span className={classes.month}>{start.toFormat('MMM')}</span>
      <span className={classes.day}>{start.toFormat('d')}</span>
    </div>
  )
}
