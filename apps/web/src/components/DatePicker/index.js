import { cn } from 'util/index'
import classes from './datePicker.module.scss'
import { DateTime } from 'luxon'
import React from 'react'

function isValidDate (current) {
  const yesterday = DateTime.now().minus({day: 1})
  return DateTime.fromJSDate(current) > yesterday
}

function DatePicker (props) {
  const { placeholder } = props
  return (
    <DateTime
      {...props}
      className={cn(classes.datePicker, props.className)}
      isValidDate={isValidDate}
      inputProps={{ placeholder }}
    />
  )
}

export default DatePicker
