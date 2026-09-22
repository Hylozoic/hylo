import { Search } from 'lucide-react'
import React, { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import { FIELD_LABEL_CLASS } from 'components/ui/form-field'
import { cn } from 'util/index'
import { SPACE_ICON_SUGGESTIONS } from './spaceFormConstants'

// Tile geometry the fit calculation depends on: w-4 icon (16) + p-2 (16) + border-2 (4).
const TILE_WIDTH = 36
const TILE_GAP = 8

/** Icon field for the space create/edit modals: suggested icons and a Search Icons
 * picker on a single row, dropping trailing suggestions as the column narrows.
 * The selected icon is always shown — a choice from the picker that isn't among
 * the visible suggestions takes the first tile. */
export default function SpaceIconRow ({ value, onChange }) {
  const { t } = useTranslation()
  const containerRef = useRef()
  const searchRef = useRef()
  const [fitCount, setFitCount] = useState(SPACE_ICON_SUGGESTIONS.length)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const compute = () => {
      const searchWidth = searchRef.current?.offsetWidth || 0
      const available = container.clientWidth - searchWidth - TILE_GAP
      setFitCount(Math.max(1, Math.floor((available + TILE_GAP) / (TILE_WIDTH + TILE_GAP))))
    }
    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const visible = SPACE_ICON_SUGGESTIONS.slice(0, Math.min(fitCount, SPACE_ICON_SUGGESTIONS.length))
  if (value && !visible.includes(value)) {
    visible.length = Math.max(0, visible.length - 1)
    visible.unshift(value)
  }

  return (
    <div className='flex flex-col gap-1'>
      <label className={FIELD_LABEL_CLASS}>{t('Icon')}</label>
      <div ref={containerRef} className='flex flex-nowrap items-center gap-2 overflow-hidden'>
        {visible.map(iconName => (
          <button
            key={iconName}
            type='button'
            onClick={() => onChange(iconName)}
            aria-label={iconName}
            className={cn(
              'flex shrink-0 items-center justify-center rounded-md border-2 p-2 transition-all',
              value === iconName
                ? 'border-selected bg-selected/20'
                : 'border-foreground/20 hover:border-foreground/50'
            )}
          >
            <LucideIcon name={iconName} className='w-4 h-4' />
          </button>
        ))}
        <div ref={searchRef} className='ml-auto shrink-0'>
          <LucideIconPicker
            value={value}
            onChange={onChange}
            trigger={
              <button
                type='button'
                className='flex items-center gap-1.5 rounded-md border-2 border-foreground/20 px-2.5 py-2 text-xs font-semibold text-foreground/70 hover:border-foreground/50 hover:text-foreground transition-all whitespace-nowrap'
              >
                <Search className='w-4 h-4' />
                {t('Search Icons')}
              </button>
            }
          />
        </div>
      </div>
    </div>
  )
}
