import React from 'react'
import { cn } from 'util/index'
import classes from './datePicker.module.scss'
import Datetime from 'react-datetime'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'

function isValidDate (current) {
  const yesterday = DateTimeHelpers.dateTimeNow(getLocaleFromLocalStorage()).minus({ day: 1 })
  return DateTimeHelpers.toDateTime(current, { locale: getLocaleFromLocalStorage() }) > yesterday
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
