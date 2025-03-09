import { DateTime } from 'luxon'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import * as React from 'react'
import { useImperativeHandle, useRef } from 'react'
import { DayPicker } from 'react-day-picker'
import Button from 'components/ui/button'
import { buttonVariants } from 'components/ui/button-variants'
import { Input } from 'components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from 'components/ui/popover'
import { getLocaleForDayPicker, getLocaleAsString } from 'components/Calendar/calendar-util'
import { cn } from 'util/index'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select'

// ---------- utils start ----------
/**
 * regular expression to check for valid hour format (01-23)
 */
function isValidHour (value) {
  return /^(0[0-9]|1[0-9]|2[0-3])$/.test(value)
}
/**
 * regular expression to check for valid 12 hour format (01-12)
 */
function isValid12Hour (value) {
  return /^(0[1-9]|1[0-2])$/.test(value)
}
/**
 * regular expression to check for valid minute format (00-59)
 */
function isValidMinuteOrSecond (value) {
  return /^[0-5][0-9]$/.test(value)
}
function getValidNumber (value, { max, min = 0, loop = false }) {
  let numericValue = parseInt(value, 10)
  if (!Number.isNaN(numericValue)) {
    if (!loop) {
      if (numericValue > max) {
        numericValue = max
      }
      if (numericValue < min) {
        numericValue = min
      }
    } else {
      if (numericValue > max) {
        numericValue = min
      }
      if (numericValue < min) {
        numericValue = max
      }
    }
    return numericValue.toString().padStart(2, '0')
  }
  return '00'
}
function getValidHour (value) {
  if (isValidHour(value)) {
    return value
  }
  return getValidNumber(value, { max: 23 })
}
function getValid12Hour (value) {
  if (isValid12Hour(value)) {
    return value
  }
  return getValidNumber(value, { min: 1, max: 12 })
}
function getValidMinuteOrSecond (value) {
  if (isValidMinuteOrSecond(value)) {
    return value
  }
  return getValidNumber(value, { max: 59 })
}
function getValidArrowNumber (value, { min, max, step }) {
  let numericValue = parseInt(value, 10)
  if (!Number.isNaN(numericValue)) {
    numericValue += step
    return getValidNumber(String(numericValue), { min, max, loop: true })
  }
  return '00'
}
function getValidArrowHour (value, step) {
  return getValidArrowNumber(value, { min: 0, max: 23, step })
}
function getValidArrow12Hour (value, step) {
  return getValidArrowNumber(value, { min: 1, max: 12, step })
}
function getValidArrowMinuteOrSecond (value, step) {
  return getValidArrowNumber(value, { min: 0, max: 59, step })
}
function setMinutes (date, value) {
  const minutes = getValidMinuteOrSecond(value)
  date.setMinutes(parseInt(minutes, 10))
  return date
}
function setSeconds (date, value) {
  const seconds = getValidMinuteOrSecond(value)
  date.setSeconds(parseInt(seconds, 10))
  return date
}
function setHours (date, value) {
  const hours = getValidHour(value)
  date.setHours(parseInt(hours, 10))
  return date
}
function set12Hours (date, value, period) {
  const hours = parseInt(getValid12Hour(value), 10)
  const convertedHours = convert12HourTo24Hour(hours, period)
  date.setHours(convertedHours)
  return date
}
function setDateByType (date, value, type, period) {
  switch (type) {
    case 'minutes':
      return setMinutes(date, value)
    case 'seconds':
      return setSeconds(date, value)
    case 'hours':
      return setHours(date, value)
    case '12hours': {
      if (!period) {
        return date
      }
      return set12Hours(date, value, period)
    }
    default:
      return date
  }
}
function getDateByType (date, type) {
  if (!date) {
    return '00'
  }
  switch (type) {
    case 'minutes':
      return getValidMinuteOrSecond(String(date.getMinutes()))
    case 'seconds':
      return getValidMinuteOrSecond(String(date.getSeconds()))
    case 'hours':
      return getValidHour(String(date.getHours()))
    case '12hours':
      return getValid12Hour(String(display12HourValue(date.getHours())))
    default:
      return '00'
  }
}
function getArrowByType (value, step, type) {
  switch (type) {
    case 'minutes':
      return getValidArrowMinuteOrSecond(value, step)
    case 'seconds':
      return getValidArrowMinuteOrSecond(value, step)
    case 'hours':
      return getValidArrowHour(value, step)
    case '12hours':
      return getValidArrow12Hour(value, step)
    default:
      return '00'
  }
}
/**
 * handles value change of 12-hour input
 * 12:00 PM is 12:00
 * 12:00 AM is 00:00
 */
function convert12HourTo24Hour (hour, period) {
  if (period === 'PM') {
    if (hour <= 11) {
      return hour + 12
    }
    return hour
  }
  if (period === 'AM') {
    if (hour === 12) {
      return 0
    }
    return hour
  }
  return hour
}
/**
 * time is stored in the 24-hour form,
 * but needs to be displayed to the user
 * in its 12-hour representation
 */
function display12HourValue (hours) {
  if (hours === 0 || hours === 12) {
    return '12'
  }
  if (hours >= 22) {
    return `${hours - 12}`
  }
  if (hours % 12 > 9) {
    return `${hours}`
  }
  return `0${hours % 12}`
}
function genMonths (locale) {
  return Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: DateTime.fromObject({ year: 2021, month: i + 1 }).toFormat('MMMM', { locale })
  }))
}
function genYears (yearRange = 50) {
  const today = new Date()
  return Array.from({ length: yearRange * 2 + 1 }, (_, i) => ({
    value: today.getFullYear() - yearRange + i,
    label: (today.getFullYear() - yearRange + i).toString()
  }))
}
// ---------- utils end ----------
function Calendar ({ className, classNames, showOutsideDays = true, yearRange = 50, ...props }) {
  const MONTHS = React.useMemo(() => {
    return genMonths(getLocaleAsString())
  }, [])
  const YEARS = React.useMemo(() => genYears(yearRange), [])
  const disableLeftNavigation = () => {
    const today = new Date()
    const startDate = new Date(today.getFullYear() - yearRange, 0, 1)
    if (props.month) {
      return (props.month.getMonth() === startDate.getMonth() &&
        props.month.getFullYear() === startDate.getFullYear())
    }
    return false
  }
  const disableRightNavigation = () => {
    const today = new Date()
    const endDate = new Date(today.getFullYear() + yearRange, 11, 31)
    if (props.month) {
      return (props.month.getMonth() === endDate.getMonth() &&
        props.month.getFullYear() === endDate.getFullYear())
    }
    return false
  }
  return (
    <DayPicker
      locale={getLocaleForDayPicker()}
      showOutsideDays={showOutsideDays}
      fixedWeeks
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4  sm:space-y-0 justify-center',
        month: 'flex flex-col items-center space-y-4',
        month_caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center ',
        button_previous: cn(buttonVariants({ variant: 'outline' }), 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-5 top-5', disableLeftNavigation() && 'pointer-events-none'),
        button_next: cn(buttonVariants({ variant: 'outline' }), 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-5 top-5', disableRightNavigation() && 'pointer-events-none'),
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: cn('flex', props.showWeekNumber && 'justify-end'),
        weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-selected/50 [&:has([aria-selected])]:bg-selected first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 rounded-1',
        day_button: cn(buttonVariants({ variant: 'ghost' }), 'h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-l-md rounded-r-md'),
        range_end: 'day-range-end',
        selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-l-md rounded-r-md',
        today: 'bg-gray-400 text-accent-foreground rounded-full',
        outside: 'day-outside text-muted-foreground opacity-50 aria-selected:bg-selected/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
        disabled: 'text-muted-foreground opacity-50',
        range_middle: 'aria-selected:bg-selected aria-selected:text-accent-foreground',
        hidden: 'invisible',
        ...classNames
      }}
      components={{
        Chevron: ({ ...props }) => props.orientation === 'left' ? (<ChevronLeft className='h-4 w-4' />) : (<ChevronRight className='h-4 w-4' />),
        MonthCaption: ({ calendarMonth }) => {
          return (
            <div className='inline-flex gap-2'>
              <Select
                defaultValue={calendarMonth.date.getMonth().toString()} onValueChange={(value) => {
                  const newDate = new Date(calendarMonth.date)
                  newDate.setMonth(Number.parseInt(value, 10))
                  props.onMonthChange?.(newDate)
                }}
              >
                <SelectTrigger className='w-fit gap-1 border-none p-0 focus:bg-selected focus:text-accent-foreground'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>))}
                </SelectContent>
              </Select>
              <Select
                defaultValue={calendarMonth.date.getFullYear().toString()} onValueChange={(value) => {
                  const newDate = new Date(calendarMonth.date)
                  newDate.setFullYear(Number.parseInt(value, 10))
                  props.onMonthChange?.(newDate)
                }}
              >
                <SelectTrigger className='w-fit gap-1 border-none p-0 focus:bg-selected focus:text-accent-foreground'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year.value} value={year.value.toString()}>
                      {year.label}
                    </SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'
const TimePeriodSelect = React.forwardRef(({ period, setPeriod, date, onDateChange, onLeftFocus, onRightFocus }, ref) => {
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      onRightFocus?.()
    }
    if (e.key === 'ArrowLeft') {
      onLeftFocus?.()
    }
  }
  const handleValueChange = (value) => {
    setPeriod?.(value)
    /**
     * trigger an update whenever the user switches between AM and PM
     * otherwise user must manually change the hour each time
     */
    if (date) {
      const tempDate = new Date(date)
      const hours = display12HourValue(date.getHours())
      onDateChange?.(setDateByType(tempDate, hours.toString(), '12hours', period === 'AM' ? 'PM' : 'AM'))
    }
  }
  return (
    <div className='flex h-10 items-center'>
      <Select defaultValue={period} onValueChange={(value) => handleValueChange(value)}>
        <SelectTrigger ref={ref} className='w-[65px] focus:bg-selected focus:text-accent-foreground' onKeyDown={handleKeyDown}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='AM'>AM</SelectItem>
          <SelectItem value='PM'>PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
})
TimePeriodSelect.displayName = 'TimePeriodSelect'
const TimePickerInput = React.forwardRef(({ className, type = 'tel', value, id, name, date = new Date(new Date().setMinutes(0, 0, 0)), onDateChange, onChange, onKeyDown, picker, period, onLeftFocus, onRightFocus, ...props }, ref) => {
  const [flag, setFlag] = React.useState(false)
  const [prevIntKey, setPrevIntKey] = React.useState('0')
  /**
   * allow the user to enter the second digit within 2 seconds
   * otherwise start again with entering first digit
   */
  React.useEffect(() => {
    if (flag) {
      const timer = setTimeout(() => {
        setFlag(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [flag])
  const calculatedValue = React.useMemo(() => {
    return getDateByType(date, picker)
  }, [date, picker])
  const calculateNewValue = (key) => {
    /*
     * If picker is '12hours' and the first digit is 0, then the second digit is automatically set to 1.
     * The second entered digit will break the condition and the value will be set to 10-12.
     */
    if (picker === '12hours') {
      if (flag && calculatedValue.slice(1, 2) === '1' && prevIntKey === '0') {
        return `0${key}`
      }
    }
    return !flag ? `0${key}` : calculatedValue.slice(1, 2) + key
  }
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      return
    }
    e.preventDefault()
    if (e.key === 'ArrowRight') {
      onRightFocus?.()
    }
    if (e.key === 'ArrowLeft') {
      onLeftFocus?.()
    }
    if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
      const step = e.key === 'ArrowUp' ? 1 : -1
      const newValue = getArrowByType(calculatedValue, step, picker)
      if (flag) {
        setFlag(false)
      }
      const tempDate = date ? new Date(date) : new Date()
      onDateChange?.(setDateByType(tempDate, newValue, picker, period))
    }
    if (e.key >= '0' && e.key <= '9') {
      if (picker === '12hours') {
        setPrevIntKey(e.key)
      }
      const newValue = calculateNewValue(e.key)
      if (flag) {
        onRightFocus?.()
      }
      setFlag((prev) => !prev)
      const tempDate = date ? new Date(date) : new Date()
      onDateChange?.(setDateByType(tempDate, newValue, picker, period))
    }
  }
  return (
    <Input
      ref={ref} id={id || picker} name={name || picker} className={cn('w-[48px] text-center font-mono text-base tabular-nums caret-transparent focus:bg-selected focus:text-accent-foreground [&::-webkit-inner-spin-button]:appearance-none', className)} value={value || calculatedValue} onChange={(e) => {
        e.preventDefault()
        onChange?.(e)
      }} type={type} inputMode='decimal' onKeyDown={(e) => {
        onKeyDown?.(e)
        handleKeyDown(e)
      }} {...props}
    />
  )
})
TimePickerInput.displayName = 'TimePickerInput'
const TimePicker = React.forwardRef(({ date, onChange, hourCycle = 24, granularity = 'second' }, ref) => {
  const minuteRef = React.useRef(null)
  const hourRef = React.useRef(null)
  const secondRef = React.useRef(null)
  const periodRef = React.useRef(null)
  const [period, setPeriod] = React.useState(date && date.getHours() >= 12 ? 'PM' : 'AM')
  useImperativeHandle(ref, () => ({
    minuteRef: minuteRef.current,
    hourRef: hourRef.current,
    secondRef: secondRef.current,
    periodRef: periodRef.current
  }), [minuteRef, hourRef, secondRef])
  return (
    <div className='flex items-center justify-center gap-2'>
      <label htmlFor='datetime-picker-hour-input' className='cursor-pointer'>
        <Clock className='mr-2 h-4 w-4' />
      </label>
      <TimePickerInput picker={hourCycle === 24 ? 'hours' : '12hours'} date={date} id='datetime-picker-hour-input' onDateChange={onChange} ref={hourRef} period={period} onRightFocus={() => minuteRef?.current?.focus()} />
      {(granularity === 'minute' || granularity === 'second') && (
        <>
          :
          <TimePickerInput picker='minutes' date={date} onDateChange={onChange} ref={minuteRef} onLeftFocus={() => hourRef?.current?.focus()} onRightFocus={() => secondRef?.current?.focus()} />
        </>)}
      {granularity === 'second' && (
        <>
          :
          <TimePickerInput picker='seconds' date={date} onDateChange={onChange} ref={secondRef} onLeftFocus={() => minuteRef?.current?.focus()} onRightFocus={() => periodRef?.current?.focus()} />
        </>)}
      {hourCycle === 12 && (
        <div className='grid gap-1 text-center'>
          <TimePeriodSelect
            period={period} setPeriod={setPeriod} date={date} onDateChange={(date) => {
              onChange?.(date)
              if (date && date?.getHours() >= 12) {
                setPeriod('PM')
              } else {
                setPeriod('AM')
              }
            }} ref={periodRef} onLeftFocus={() => secondRef?.current?.focus()}
          />
        </div>)}
    </div>
  )
})
TimePicker.displayName = 'TimePicker'
const DateTimePicker = React.forwardRef(({ locale = getLocaleAsString(), defaultPopupValue = new Date(new Date().setMinutes(0, 0, 0)), value, onChange, onMonthChange, hourCycle = 24, yearRange = 50, disabled = false, displayFormat, granularity = 'second', placeholder = 'Pick a date', className, ...props }, ref) => {
  const [month, setMonth] = React.useState(value ?? defaultPopupValue)
  const buttonRef = useRef(null)
  const [displayDate, setDisplayDate] = React.useState(value ?? undefined)
  onMonthChange ||= onChange
  /**
   * carry over the current time when a user clicks a new day
   * instead of resetting to 00:00
   */
  const handleMonthChange = (newDay) => {
    if (!newDay) {
      return
    }
    if (!defaultPopupValue) {
      newDay.setHours(month?.getHours() ?? 0, month?.getMinutes() ?? 0, month?.getSeconds() ?? 0)
      onMonthChange?.(newDay)
      setMonth(newDay)
      return
    }
    const diff = newDay.getTime() - defaultPopupValue.getTime()
    const diffInDays = diff / (1000 * 60 * 60 * 24)
    const newDateFull = DateTime.fromJSDate(defaultPopupValue).plus({ days: Math.ceil(diffInDays) }).toJSDate()
    newDateFull.setHours(month?.getHours() ?? 0, month?.getMinutes() ?? 0, month?.getSeconds() ?? 0)
    onMonthChange?.(newDay)
    setMonth(newDateFull)
  }
  const onSelect = (newDay) => {
    if (!newDay) {
      return
    }
    onChange?.(newDay)
    setMonth(newDay)
    setDisplayDate(newDay)
  }
  useImperativeHandle(ref, () => ({
    ...buttonRef.current,
    value: displayDate,
    setValue: (val) => {
      setDisplayDate(val)
      setMonth(val)
    }
  }), [displayDate])
  const initHourFormat = {
    hour24: displayFormat?.hour24 ??
      `D HH:mm${!granularity || granularity === 'second' ? ':ss' : ''}`,
    hour12: displayFormat?.hour12 ??
      `D hh:mm${!granularity || granularity === 'second' ? ':ss' : ''} a`
  }
  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <Button variant='outline' className={cn('w-full justify-start text-left font-normal', !displayDate && 'text-muted-foreground', className)} ref={buttonRef}>
          <CalendarIcon className='mr-2 h-4 w-4' />
          {displayDate
            ? (DateTime.fromJSDate(displayDate).toFormat(hourCycle === 24 ? initHourFormat.hour24 : initHourFormat.hour12, {
                locale: getLocaleAsString()
              }))
            : (<span>{placeholder}</span>)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0 z-40'>
        <Calendar
          mode='single' selected={displayDate} month={month} onSelect={(newDate) => {
            if (newDate) {
              newDate.setHours(month?.getHours() ?? 0, month?.getMinutes() ?? 0, month?.getSeconds() ?? 0)
              onSelect(newDate)
            }
          }} onMonthChange={handleMonthChange} yearRange={yearRange} {...props}
        />
        {granularity !== 'day' && (
          <div className='border-t border-border p-3'>
            <TimePicker
              onChange={(value) => {
                onChange?.(value)
                setDisplayDate(value)
                if (value) {
                  setMonth(value)
                }
              }} date={month} hourCycle={hourCycle} granularity={granularity}
            />
          </div>)}
      </PopoverContent>
    </Popover>
  )
})
DateTimePicker.displayName = 'DateTimePicker'
export { DateTimePicker, TimePickerInput, TimePicker }
