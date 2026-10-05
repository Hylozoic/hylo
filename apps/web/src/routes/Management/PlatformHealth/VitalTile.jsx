import React from 'react'
import { useFormat } from './format'
import HeadlineChange from './HeadlineChange'
import SeriesChart from './SeriesChart'
import { ComparisonHeadline, headlineDirection, headlineUnit, metricHeadline, usePeriodLabel } from './MetricCard'

// The panel scrolls inside its own container, so the jump is done here; focus moves to the card so the
// next Tab continues from it rather than from the tile
function jumpTo (event, id) {
  const target = document.getElementById(id)
  if (!target) return
  event.preventDefault()
  if (typeof target.scrollIntoView === 'function') {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }
  target.focus({ preventScroll: true })
}

/**
 * Compact tile for a vital metric: headline, change vs previous, and a sparkline for series.
 * Links to the metric's full card below. With a `comparison`, also the change since the earlier period.
 */
export default function VitalTile ({ metric, comparison }) {
  const fmt = useFormat()
  const { t } = fmt
  const headline = metricHeadline(metric)
  const periodLabel = usePeriodLabel(metric, headline)
  const targetId = `metric-${metric.id}`

  return (
    <a
      href={`#${targetId}`}
      onClick={event => jumpTo(event, targetId)}
      className='group flex flex-col gap-1 rounded-lg border border-foreground/10 bg-card p-3 shadow-sm hover:border-foreground/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-colors motion-reduce:transition-none no-underline'
      data-testid={`vital-tile-${metric.id}`}
    >
      <span className='text-xs font-medium text-foreground/70 leading-snug line-clamp-2 group-hover:text-foreground'>{metric.label}</span>
      {metric.error
        ? <span className='text-xs text-red-700 dark:text-red-400'>{t('Not available')}</span>
        : (
          <>
            <span className='text-xl font-semibold tabular-nums text-foreground'>{fmt.value(headline?.value ?? null, headlineUnit(metric))}</span>
            <span className='flex flex-wrap items-center gap-x-2'>
              {headline && <HeadlineChange value={headline.value} previous={headline.previous} unit={headlineUnit(metric)} goodDirection={headlineDirection(metric)} />}
              {periodLabel && <span className='text-2xs text-foreground/50'>{periodLabel}</span>}
            </span>
            {headline && comparison && <ComparisonHeadline metric={metric} headline={headline} comparison={comparison} compact />}
            {metric.display === 'kpi' && typeof metric.data?.numerator === 'number' && typeof metric.data?.denominator === 'number' && (
              <span className='text-xs text-foreground/60 tabular-nums'>
                {t('{{numerator}} of {{denominator}}', {
                  numerator: fmt.value(metric.data.numerator, 'count'),
                  denominator: fmt.value(metric.data.denominator, 'count')
                })}
              </span>
            )}
            {metric.display === 'series' && metric.data && (
              <span className='mt-1 block'>
                <SeriesChart data={metric.data} unit={metric.unit} variant='spark' comparison={comparison} />
              </span>
            )}
          </>
          )}
    </a>
  )
}
