import React from 'react'
import { cn } from 'util/index'
import { changeTone, useFormat } from './format'

const ARROWS = { up: '▲', down: '▼', flat: '■' }

const TONE_CLASSES = {
  good: 'text-green-700 dark:text-green-400',
  bad: 'text-red-700 dark:text-red-400',
  neutral: 'text-foreground/60'
}

/**
 * Change vs the previous period: an arrow glyph for direction, plus color and a word for good or bad.
 */
export default function HeadlineChange ({ value, previous, unit, goodDirection, className }) {
  const fmt = useFormat()
  const { t } = fmt
  const change = changeTone(value, previous, goodDirection)
  if (!change) return null

  const amount = fmt.change(change.delta, unit)
  const previousText = fmt.value(previous, unit)
  const toneLabel = change.tone === 'good'
    ? t('better')
    : change.tone === 'bad' ? t('worse') : null

  let description
  if (change.direction === 'up') description = t('Up {{amount}} from {{previous}}', { amount, previous: previousText })
  else if (change.direction === 'down') description = t('Down {{amount}} from {{previous}}', { amount, previous: previousText })
  else description = t('No change from {{previous}}', { previous: previousText })

  return (
    <span
      className={cn('inline-flex flex-wrap items-center gap-x-1 text-xs font-medium tabular-nums', TONE_CLASSES[change.tone], className)}
      title={toneLabel ? `${description} (${toneLabel})` : description}
      data-testid='headline-change'
      data-tone={change.tone}
    >
      <span aria-hidden='true' className='whitespace-nowrap'>{ARROWS[change.direction]} {change.direction === 'flat' ? t('no change') : amount}</span>
      {toneLabel && <span aria-hidden='true' className='font-normal'>{toneLabel}</span>}
      <span className='sr-only'>{toneLabel ? `${description}, ${toneLabel}` : description}</span>
    </span>
  )
}
