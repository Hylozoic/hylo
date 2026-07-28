import React from 'react'
import { useTranslation } from 'react-i18next'

import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import { CUSTOM_VIEW_VIEW_MODE_OPTIONS } from './customViewFormConstants'
import { cn } from 'util/index'

/** Radio group for choosing a custom view's default display mode. */
export default function DefaultViewModePicker ({ value, onChange, className }) {
  const { t } = useTranslation()

  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {CUSTOM_VIEW_VIEW_MODE_OPTIONS.map(option => (
        <label
          key={option.value}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors',
            value === option.value
              ? 'border-selected bg-selected/20 text-foreground'
              : 'border-foreground/20 text-foreground/70 hover:border-foreground/40'
          )}
        >
          <RadioGroupItem value={option.value} className='border-foreground/40' />
          <span>{t(option.labelKey, { defaultValue: option.defaultLabel })}</span>
        </label>
      ))}
    </RadioGroup>
  )
}
