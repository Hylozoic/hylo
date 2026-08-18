import React from 'react'
import { cn } from 'util/index'

const DESCRIPTION_ALIGNMENT = ['text-left', 'text-center', 'text-right']

/**
 * A row of mutually exclusive options with one shared description underneath, which
 * swaps to describe whichever option is selected — so the explanation costs one line
 * instead of one per option. The selected option shows its icon; the description
 * aligns under the option it belongs to.
 *
 * `options`: [{ value, label, description, icon?, renderIcon?, disabled? }]
 */
export default function SegmentedPicker ({ value, onChange, options, className }) {
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))
  const selected = options[selectedIndex]

  return (
    <div className={cn('rounded-lg border-2 border-foreground/20 bg-input p-1', className)}>
      <div className='flex w-full gap-1'>
        {options.map(option => {
          const isSelected = option.value === value
          const OptionIcon = option.icon
          return (
            <button
              key={option.value}
              type='button'
              onClick={() => onChange(option.value)}
              disabled={option.disabled}
              aria-pressed={isSelected}
              className={cn(
                'flex flex-1 min-w-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                isSelected ? 'bg-selected/25 text-foreground' : 'text-foreground/60 hover:text-foreground',
                option.disabled && 'cursor-default'
              )}
            >
              {isSelected && (option.renderIcon
                ? option.renderIcon('w-4 h-4 shrink-0')
                : OptionIcon && <OptionIcon className='w-4 h-4 shrink-0' />)}
              <span className='truncate'>{option.label}</span>
            </button>
          )
        })}
      </div>
      {/* The description carries no bottom padding of its own — the container's
          padding bounds it, so the control keeps an even inset on every edge */}
      {selected?.description && (
        <p className={cn('px-2 pt-2 pb-0 mt-0 mb-0 text-xs text-foreground/70', DESCRIPTION_ALIGNMENT[selectedIndex])}>
          {selected.description}
        </p>
      )}
    </div>
  )
}
