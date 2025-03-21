import { cn } from 'util/index'
import classes from './datePicker.module.scss'
import Datetime from 'react-datetime'
import { toDateTime, dateTimeNow } from '@hylo/shared/src/DateTimeHelper'
import React from 'react'

function isValidDate (current) {
  const yesterday = dateTimeNow().minus({ day: 1 })
  return toDateTime(current) > yesterday
}

function DatePicker (props) {
  const { placeholder } = props
  return (
    <Datetime
      {...props}
      className={cn(classes.datePicker, props.className)}
      isValidDate={isValidDate}
      inputProps={{ placeholder }}
    />
  )
}

export default DatePicker
