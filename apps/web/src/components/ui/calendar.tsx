'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar ({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays} className={cn('p-3', className)} classNames={{
        months: 'flex-col sm:flex-row space-y-4 sm:space-y-0 justify-center',
        month: 'flex flex-col items-center space-y-4',
        month_caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center ',
        button_previous: cn(buttonVariants({ variant: 'outline' }), 'h-7 w-7 p-0 opacity-50 hover:opacity-100'),
        button_next: cn(buttonVariants({ variant: 'outline' }), 'h-7 w-7 p-0 opacity-50 hover:opacity-100'),
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: cn('flex', props.showWeekNumber && 'justify-end'),
        weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-selected/50 [&:has([aria-selected])]:bg-selected first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 rounded-1',
        day_button: cn(buttonVariants({ variant: 'ghost' }), 'h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-l-md rounded-r-md'),
        range_end: 'day-range-end',
        selected: 'bg-selected text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-l-md rounded-r-md',
        today: 'bg-black text-accent-foreground rounded-full',
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
