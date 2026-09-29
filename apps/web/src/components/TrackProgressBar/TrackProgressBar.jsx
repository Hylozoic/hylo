import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import { progressFromCounts } from 'util/trackProgress'

/** "N of M completed" with a bar, for a learner's progress through a track (D33). */
export default function TrackProgressBar ({ completed, total, className }) {
  const { t } = useTranslation()
  const progress = progressFromCounts(completed, total)
  if (!progress.total) return null
  const label = t('{{completed}} of {{total}} completed', { completed: progress.completed, total: progress.total })

  return (
    <div className={cn('flex flex-col gap-1', className)} data-testid='track-progress'>
      <span className='text-xs text-foreground/70'>{label}</span>
      <div
        className='h-2 w-full rounded-full bg-foreground/10 overflow-hidden'
        role='progressbar'
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.completed}
      >
        <div
          className={cn('h-full rounded-full transition-all', progress.isComplete ? 'bg-green-500' : 'bg-selected')}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  )
}
