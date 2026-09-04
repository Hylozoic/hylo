import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown } from 'lucide-react'
import { DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'
import { cn } from 'util/index'
import Button from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'

/**
 * Searchable timezone selector using IANA identifiers with offset and friendly labels.
 */
export default function TimezoneSelect ({
  value,
  onChange,
  disabled = false,
  className
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const locale = getLocaleFromLocalStorage()
  const userTimezone = useMemo(() => DateTimeHelpers.getCurrentTimezone(), [])

  const timezoneOptions = useMemo(
    () => DateTimeHelpers.getTimezoneOptions(locale),
    [locale]
  )

  const selectedOption = useMemo(
    () => timezoneOptions.find(option => option.value === value),
    [timezoneOptions, value]
  )

  const userOption = useMemo(
    () => timezoneOptions.find(option => option.value === userTimezone),
    [timezoneOptions, userTimezone]
  )

  const otherOptions = useMemo(
    () => timezoneOptions.filter(option => option.value !== userTimezone),
    [timezoneOptions, userTimezone]
  )

  const handleSelect = (timezone) => {
    onChange(timezone)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled}
          className={cn('min-h-11 sm:min-h-10 w-full justify-between font-normal touch-manipulation', className)}
        >
          <span className='truncate'>
            {selectedOption?.label || value || t('Select timezone')}
          </span>
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[min(100vw-2rem,420px)] p-0' align='start'>
        <Command>
          <CommandInput placeholder={t('Search timezones...')} />
          <CommandList>
            <CommandEmpty>{t('No timezone found')}</CommandEmpty>
            {userOption && (
              <CommandGroup heading={t('Your timezone')}>
                <CommandItem
                  key={userOption.value}
                  value={`${userOption.label} ${userOption.value}`}
                  onSelect={() => handleSelect(userOption.value)}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === userOption.value ? 'opacity-100' : 'opacity-0')} />
                  {userOption.label}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={t('All timezones')}>
              {otherOptions.map(option => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
