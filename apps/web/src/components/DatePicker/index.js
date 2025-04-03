import { cn } from 'util/index'
import classes from './datePicker.module.scss'
import Datetime from 'react-datetime'
import { DateTimeHelpers } from '@hylo/shared'
import React from 'react'
import { localeLocalStorageSync } from 'util/locale'

function isValidDate (current) {
  const yesterday = DateTimeHelpers.dateTimeNow(localeLocalStorageSync()).minus({ day: 1 })
  return DateTimeHelpers.toDateTime(current, { locale: localeLocalStorageSync() }) > yesterday
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
