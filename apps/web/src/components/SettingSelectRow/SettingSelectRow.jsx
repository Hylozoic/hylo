import { ChevronDown } from 'lucide-react'
import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Popover, PopoverContent, PopoverTrigger } from 'components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import { cn } from 'util/index'

// Returns the nearest open dialog so popovers portal inside it. Radix dialogs are
// modal, so content portalled to document.body sits behind the scroll lock and
// stops responding to clicks.
function popoverSurface (element) {
  if (!element || typeof element.closest !== 'function') return undefined
  return element.closest('[role="dialog"][data-state="open"]') || undefined
}

// A setting rendered as its own heading: the chosen option's title is the label and
// its explanation sits underneath, so the current choice reads as a sentence rather
// than as a value inside a form control. `popoverClassName` lets non-dialog hosts
// (e.g. the space modals' z-[1100] portals) lift the options above their overlay.
// Options may set `disabled` + `disabledTooltip` to stay visible but unselectable.
export default function SettingSelectRow ({ value, onChange, options, label, popoverClassName }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef()
  const selected = options.find(o => o.value === value) || options[0]
  const SelectedIcon = selected.icon

  return (
    <div className='flex items-start gap-3' ref={anchorRef}>
      <div className='w-9 h-9 shrink-0 rounded-full bg-selected/20 text-selected flex items-center justify-center'>
        <SelectedIcon className='w-[18px] h-[18px]' />
      </div>
      <div className='flex-1 min-w-0'>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type='button'
              aria-label={t(label)}
              className={cn(
                '-ml-2 inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-[15px] font-bold text-foreground transition-colors',
                open ? 'bg-foreground/10' : 'hover:bg-foreground/5'
              )}
            >
              {t(selected.title)}
              <ChevronDown className={cn('w-3 h-3 opacity-60 transition-transform', open && 'rotate-180')} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align='start'
            arrow={false}
            container={popoverSurface(anchorRef.current)}
            className={cn('w-[280px] p-1.5', popoverClassName)}
          >
            {options.map(option => {
              const OptionIcon = option.icon
              const isSelected = option.value === value
              const isDisabled = Boolean(option.disabled)
              const row = (
                <button
                  type='button'
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                    isDisabled && 'opacity-40 cursor-not-allowed',
                    !isDisabled && (isSelected ? 'bg-selected/20 text-selected' : 'text-foreground/80 hover:bg-foreground/5')
                  )}
                >
                  <OptionIcon className='w-4 h-4 shrink-0' />
                  <span className='text-sm font-semibold'>{t(option.title)}</span>
                </button>
              )

              if (!isDisabled || !option.disabledTooltip) {
                return <React.Fragment key={option.value}>{row}</React.Fragment>
              }

              // Disabled buttons don't fire hover — wrap so the tooltip still appears.
              return (
                <Tooltip key={option.value}>
                  <TooltipTrigger asChild>
                    <div className='w-full'>{row}</div>
                  </TooltipTrigger>
                  <TooltipContent side='right' className='z-[1300] max-w-[240px] text-xs'>
                    {t(option.disabledTooltip)}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </PopoverContent>
        </Popover>
        <p className='text-[13px] leading-snug text-foreground/60 mt-0.5 mb-0'>{t(selected.description)}</p>
      </div>
    </div>
  )
}
