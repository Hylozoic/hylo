import { X } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import { cn } from 'util/index'

/** Pill that reveals one advanced setting; shows its default in a tooltip while closed. */
export function AdvancedPill ({ isOpen, icon: Icon, label, defaultSummary, onClick }) {
  const { t } = useTranslation()
  const pill = (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={isOpen}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[13px] font-semibold transition-all',
        isOpen
          ? 'border-selected bg-selected/20 text-selected'
          : 'border-foreground/20 text-foreground/70 hover:border-foreground/50 hover:text-foreground'
      )}
    >
      <Icon className='w-3 h-3' />
      {t(label)}
    </button>
  )

  if (isOpen || !defaultSummary) return pill

  return (
    <Tooltip>
      <TooltipTrigger asChild>{pill}</TooltipTrigger>
      <TooltipContent className='flex flex-col items-start gap-0.5 py-1.5'>
        <span className='text-[9px] font-bold tracking-widest text-foreground/50'>{t('DEFAULT')}</span>
        <span className='text-xs font-semibold'>{defaultSummary}</span>
      </TooltipContent>
    </Tooltip>
  )
}

/** Revealed panel for one advanced setting, headed by its icon, label, and a hide control. */
export function AdvancedSection ({ settingKey, icon: Icon, label, onHide, children }) {
  const { t } = useTranslation()
  return (
    <div data-advanced-key={settingKey} className='rounded-xl border border-foreground/10 bg-foreground/5 p-4'>
      <div className='flex items-center gap-2 mb-1.5'>
        <Icon className='w-4 h-4 text-selected' />
        <span className='flex-1 text-sm font-bold text-foreground'>{t(label)}</span>
        <button
          type='button'
          onClick={onHide}
          aria-label={t('Hide {{label}}', { label: t(label) })}
          className='text-foreground/50 hover:text-foreground transition-colors'
        >
          <X className='w-3.5 h-3.5' />
        </button>
      </div>
      {children}
    </div>
  )
}
