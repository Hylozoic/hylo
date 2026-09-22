import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, icons } from 'lucide-react'

import LucideIcon from 'components/LucideIcon/LucideIcon'
import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from 'components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from 'components/ui/tooltip'
import { cn } from 'util/index'

const ICON_NAMES = Object.keys(icons).sort()
const ICONS_BATCH_SIZE = 80

/** Searchable picker for Lucide icon names (PascalCase strings stored on GroupView.icon).
 * Pass `trigger` to replace the default value-labelled button with a custom element. */
export default function LucideIconPicker ({ value, onChange, className, trigger }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(ICONS_BATCH_SIZE)

  const filteredIcons = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return ICON_NAMES
    return ICON_NAMES.filter(name => name.toLowerCase().includes(query))
  }, [search])

  const visibleIcons = useMemo(
    () => filteredIcons.slice(0, visibleCount),
    [filteredIcons, visibleCount]
  )

  const hasMoreIcons = visibleCount < filteredIcons.length

  useEffect(() => {
    setVisibleCount(ICONS_BATCH_SIZE)
  }, [search])

  const handleScroll = useCallback((event) => {
    const el = event.currentTarget
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
    if (!nearBottom) return
    setVisibleCount(prev => Math.min(prev + ICONS_BATCH_SIZE, filteredIcons.length))
  }, [filteredIcons.length])

  const handleSelect = (iconName) => {
    const match = ICON_NAMES.find(name => name.toLowerCase() === iconName.toLowerCase()) || iconName
    onChange(match)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setSearch('')
          setVisibleCount(ICONS_BATCH_SIZE)
        }
      }}
    >
      <PopoverTrigger asChild>
        {trigger || (
          <Button
            type='button'
            variant='outline'
            className={cn('LucideIconPicker w-full justify-start gap-2 font-normal hover:scale-100', className)}
          >
            {value
              ? <LucideIcon name={value} className='w-4 h-4 shrink-0' />
              : <span className='w-4 h-4 shrink-0 rounded-sm border border-foreground/20' />}
            <span className='truncate flex-1 text-left'>{value || t('Select an icon')}</span>
            <ChevronDown className='w-4 h-4 shrink-0 text-foreground/50' aria-hidden='true' />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className='w-80 p-2 z-[1200]' align='start'>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('Search icons...')}
          className='mb-2'
        />
        <div className='max-h-64 overflow-y-auto' onScroll={handleScroll}>
          {visibleIcons.length === 0 && (
            <div className='py-4 text-center text-sm text-foreground/60'>{t('No icon found')}</div>
          )}
          <TooltipProvider delayDuration={300}>
            <div className='grid grid-cols-6 gap-1'>
              {visibleIcons.map(name => (
                <Tooltip key={name}>
                  <TooltipTrigger asChild>
                    <button
                      type='button'
                      onClick={() => handleSelect(name)}
                      aria-label={name}
                      className={cn(
                        'flex items-center justify-center rounded-md p-2 hover:bg-selected/10',
                        value === name && 'bg-selected/20'
                      )}
                    >
                      <LucideIcon name={name} className='w-4 h-4 shrink-0' />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className='z-[1300]'>{name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
          {hasMoreIcons && (
            <div className='py-2 text-center text-xs text-foreground/50'>
              {t('Scroll for more icons')}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
