import React from 'react'
import { useTranslation } from 'react-i18next'
import Skeleton from 'components/Skeleton'
import { cn } from 'util/index'
import { CARD_CLASS, CARD_TILE_CLASS, CARD_LABEL_TOP_CLASS } from './viewCardTheme'

/**
 * Card-shaped placeholder mirroring GroupViewCard's centered tile and label.
 * Takes CARD_CLASS for its footprint so it can't drift from the real cards, and
 * drops the interaction/tint classes that only make sense on a real card.
 */
function ViewCardSkeleton ({ index = 0 }) {
  return (
    <div
      aria-hidden='true'
      style={{ '--delay': `${index * 60}ms` }}
      className={cn(
        CARD_CLASS,
        'animate-slide-up cursor-default border-foreground/5 bg-card/40 hover:translate-y-0 active:scale-100'
      )}
    >
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          <Skeleton className={CARD_TILE_CLASS} />
        </div>
        <div className={cn(CARD_LABEL_TOP_CLASS, 'absolute left-0 right-0 bottom-0 flex flex-col items-center gap-1.5 px-4 pt-1.5')}>
          <Skeleton className='h-[11px] w-[70%]' />
          <Skeleton className='h-[11px] w-[45%]' />
        </div>
      </div>
    </div>
  )
}

/**
 * Staggered card placeholders for a view grid that is still loading, so the
 * menu keeps its shape instead of collapsing to a single line of text.
 */
export default function ViewsGridSkeleton ({ count = 6, className }) {
  const { t } = useTranslation()

  return (
    <div
      className={cn('flex flex-wrap gap-3', className)}
      aria-busy='true'
      aria-label={t('Loading views…')}
    >
      {Array.from({ length: count }, (_, index) => (
        <ViewCardSkeleton key={index} index={index} />
      ))}
    </div>
  )
}
