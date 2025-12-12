'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { getLocaleForDayPicker } from 'components/Calendar/calendar-util'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button-variants'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar ({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={getLocaleForDayPicker()}
      className={cn('p-3', className)}
      navLayout='around'
      classNames={{
        months: 'flex-col sm:flex-row space-y-4 sm:space-y-0 justify-center',
        month: 'flex flex-col items-center relative',
        month_caption: 'flex pt-1 relative pb-4',
        caption_label: 'text-sm font-medium',
        button_previous: cn(buttonVariants({ variant: 'outline' }), 'size-7 p-0 opacity-50 hover:opacity-100 justify-center absolute left-0 top-0'),
        button_next: cn(buttonVariants({ variant: 'outline' }), 'size-7 p-0 opacity-50 hover:opacity-100 justify-center absolute right-0 top-0'),
        month_grid: 'border-collapse space-y-1',
        weekdays: cn('flex', props.showWeekNumber && 'justify-end'),
        weekday: 'text-muted-foreground w-9 rounded-md font-normal text-[0.8rem]',
        week: 'flex mt-2',
        day: 'size-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-selected/50 [&:has([aria-selected])]:bg-selected first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 rounded-1',
        day_button: cn(buttonVariants({ variant: 'ghost' }), 'size-9 p-0 font-normal aria-selected:opacity-100 rounded-l-md rounded-r-md'),
        range_end: 'day-range-end',
        selected: cn(props.mode !== 'multiple' && 'rounded-md text-primary-foreground', 'bg-selected focus:bg-primary focus:text-primary-foreground'),
        today: cn(props.mode !== 'multiple' && 'rounded-md', 'bg-gray-400 text-accent-foreground'),
        outside: 'day-outside text-muted-foreground opacity-50 aria-selected:bg-selected/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
        disabled: 'text-muted-foreground opacity-50',
        range_middle: 'aria-selected:bg-selected aria-selected:text-accent-foreground',
        hidden: 'invisible',
        ...classNames
      }} {...props}
    />
  )
}

export { Calendar }
