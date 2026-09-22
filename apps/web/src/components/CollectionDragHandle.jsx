import { GripVertical } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'

// Pointer devices reveal on hover; touch has no hover, so the handle stays up.
const HOVER_REVEAL = 'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100'

/**
 * Grip that is the only drag activator. Hidden until mouseover on hover-capable
 * devices; always visible on touch.
 */
export default function CollectionDragHandle ({ attributes, listeners, className }) {
  const { t } = useTranslation()

  return (
    <button
      type='button'
      aria-label={t('Drag to reorder')}
      data-testid='collection-drag-handle'
      className={cn(
        'p-1 rounded-md bg-background/80 text-foreground/70 hover:text-foreground',
        'cursor-grab active:cursor-grabbing touch-none',
        HOVER_REVEAL,
        'transition-opacity pointer-events-auto',
        className
      )}
      onClick={event => event.stopPropagation()}
      {...attributes}
      {...listeners}
    >
      <GripVertical className='w-4 h-4' />
    </button>
  )
}
