import React, { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { cn } from 'util/index'
import { isMonthlyLabels, isNumber, isStrictIsoDate, isWindowEnd, useFormat } from './format'
import { pairedHeadline } from './compare'
import HeadlineChange from './HeadlineChange'
import SeriesChart from './SeriesChart'
import CohortTable from './CohortTable'
import DataTable from './DataTable'
import KpiView from './KpiView'

const RENDERERS = {
  series: SeriesChart,
  cohort: CohortTable,
  table: DataTable,
  kpi: KpiView
}

/**
 * The value shown large on a card or tile: the server's headline, or a kpi's own value.
 */
export function metricHeadline (metric) {
  if (metric?.headline) return metric.headline
  if (metric?.display === 'kpi' && metric.data && typeof metric.data.value === 'number') {
    return { value: metric.data.value, previous: metric.data.previous ?? null, period: null }
  }
  return null
}

/**
 * Unit of the headline value. A series headline is its primary line's value, which may carry its own unit.
 */
export function headlineUnit (metric) {
  if (metric?.display === 'series') {
    const lines = metric.data?.lines || []
    const primary = lines.find(l => l.primary) || lines[0]
    if (primary?.unit) return primary.unit
  }
  return metric?.unit
}

/**
 * Good direction for the headline change. A cohort headline is its first column, which may have its own direction.
 */
export function headlineDirection (metric) {
  if (metric?.display === 'cohort') {
    const direction = metric.data?.columnDirections?.[0]
    if (direction) return direction
  }
  return metric?.goodDirection
}

/**
 * Label for the headline's period. ISO dates are formatted for the metric ('Week of …', a month name, or
 * 'N days to …' for trailing windows, from the series or the headline's windowDays); anything else
 * ('last 30 days', 'as of …') is shown verbatim.
 */
export function usePeriodLabel (metric, headline) {
  const fmt = useFormat()
  const period = headline?.period
  if (period === null || period === undefined || period === '') return null
  if (!isStrictIsoDate(period)) return String(period)
  if (isNumber(headline.windowDays) && headline.windowDays > 0) {
    return fmt.t('{{days}} days to {{date}}', { days: headline.windowDays, date: fmt.date(period) })
  }
  if (metric?.display === 'series' && isWindowEnd(metric.data)) return fmt.point(period, metric.data, { withWindow: true })
  let granularity = null
  if (metric?.display === 'series') granularity = metric.data?.granularity
  else if (metric?.display === 'cohort' && isMonthlyLabels((metric.data?.rows || []).map(r => r.label))) granularity = 'month'
  if (granularity === 'week') return fmt.t('Week of {{date}}', { date: fmt.bucket(period, 'week') })
  if (granularity === 'month') return fmt.bucket(period, 'month')
  return fmt.date(period)
}

/**
 * The change from the same metric's headline in an earlier panel, then that headline: '▲ 56 vs 1 year
 * earlier · Week of Sep 15, 2025: 307'. `comparison` is { period, label, metric } where metric is the
 * earlier panel's metric, or null when it is not available there. The earlier headline is the one for
 * the matching period (see pairedHeadline). The compact form (vital tiles) shows only the change and the
 * period, with the rest as its title.
 */
export function ComparisonHeadline ({ metric, headline, comparison, compact = false, className }) {
  const fmt = useFormat()
  const { t } = fmt
  const earlierMetric = comparison?.metric || null
  const period = comparison?.period
  const earlier = useMemo(
    () => (earlierMetric ? pairedHeadline(metric, headline, earlierMetric, metricHeadline(earlierMetric), period) : null),
    [metric, headline, earlierMetric, period]
  )
  const when = usePeriodLabel(earlierMetric, earlier)
  if (!comparison || !headline) return null

  const label = comparison.label
  if (!earlier) {
    const sentence = t('{{period}}: not available', { period: label })
    return compact
      ? <span className='text-2xs text-foreground/70' data-testid='comparison-headline'>{sentence}</span>
      : <div className={cn('text-xs text-foreground/70', className)} data-testid='comparison-headline'>{sentence}</div>
  }

  const unit = headlineUnit(metric)
  const value = fmt.value(earlier.value, unit)
  const reference = when
    ? t('vs {{period}} · {{when}}: {{value}}', { period: label, when, value })
    : t('vs {{period}}: {{value}}', { period: label, value })
  const change = <HeadlineChange value={headline.value} previous={earlier.value} unit={unit} goodDirection={headlineDirection(metric)} />

  if (compact) {
    return (
      <span className='flex flex-wrap items-center gap-x-1.5 text-2xs text-foreground/70' title={reference} data-testid='comparison-headline'>
        {change}
        <span aria-hidden='true'>{t('vs {{period}}', { period: label })}</span>
        <span className='sr-only'>{reference}</span>
      </span>
    )
  }
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-foreground/70', className)} data-testid='comparison-headline'>
      {change}
      <span>{reference}</span>
    </div>
  )
}

class RendererBoundary extends React.Component {
  constructor (props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError (error) {
    return { error }
  }

  componentDidUpdate (prevProps) {
    if (prevProps.data !== this.props.data && this.state.error) this.setState({ error: null })
  }

  render () {
    if (this.state.error) return this.props.fallback(this.state.error)
    return this.props.children
  }
}

export function MetricBody ({ metric, variant, comparison }) {
  const { t } = useTranslation()
  const Renderer = RENDERERS[metric.display]
  if (!Renderer) return null
  return (
    <RendererBoundary
      data={metric.data}
      fallback={error => (
        <p className='text-sm text-red-700 dark:text-red-400'>
          {t('This metric could not be displayed: {{error}}', { error: error?.message || String(error) })}
        </p>
      )}
    >
      <Renderer data={metric.data} unit={metric.unit} label={metric.label} variant={variant} goodDirection={metric.goodDirection} comparison={comparison?.metric ? comparison : undefined} />
    </RendererBoundary>
  )
}

/**
 * A metric card: label, headline and change, the metric's renderer, and an info disclosure with
 * the definition, why it matters and caveats. With a `comparison`, the headline and renderer also show
 * the earlier period.
 */
export default function MetricCard ({ metric, comparison }) {
  const fmt = useFormat()
  const { t } = fmt
  const [infoOpen, setInfoOpen] = useState(false)
  const infoId = useId()
  const headline = metricHeadline(metric)
  const periodLabel = usePeriodLabel(metric, headline)
  const hasError = !!metric.error

  return (
    <article
      id={`metric-${metric.id}`}
      tabIndex={-1}
      className='min-w-0 flex flex-col gap-3 rounded-lg border border-foreground/10 bg-card p-4 shadow-sm scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
      data-testid={`metric-card-${metric.id}`}
      aria-labelledby={`${infoId}-label`}
    >
      <header className='flex items-start justify-between gap-2'>
        <h3 id={`${infoId}-label`} className='text-sm font-semibold text-foreground leading-snug'>
          {metric.label}
        </h3>
        <button
          type='button'
          className={cn(
            'shrink-0 rounded-full p-1 text-foreground/60 hover:text-foreground hover:bg-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
            { 'text-foreground bg-foreground/10': infoOpen }
          )}
          aria-expanded={infoOpen}
          aria-controls={`${infoId}-info`}
          aria-label={t('About {{label}}', { label: metric.label })}
          onClick={() => setInfoOpen(open => !open)}
        >
          <Info className='w-4 h-4' aria-hidden='true' />
        </button>
      </header>

      {infoOpen && (
        <div id={`${infoId}-info`} className='rounded-md bg-foreground/5 p-3 text-xs text-foreground/80 space-y-2'>
          {metric.definition && (
            <div>
              <h4 className='font-semibold text-foreground'>{t('Definition')}</h4>
              <p className='whitespace-pre-line'>{metric.definition}</p>
            </div>
          )}
          {metric.whyItMatters && (
            <div>
              <h4 className='font-semibold text-foreground'>{t('Why it matters')}</h4>
              <p className='whitespace-pre-line'>{metric.whyItMatters}</p>
            </div>
          )}
          {metric.notes && (
            <div>
              <h4 className='font-semibold text-foreground'>{t('Notes')}</h4>
              <p className='whitespace-pre-line'>{metric.notes}</p>
            </div>
          )}
        </div>
      )}

      {hasError
        ? (
          <div className='rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm' data-testid='metric-error'>
            <p className='font-medium text-red-700 dark:text-red-400'>{t('This metric could not be computed.')}</p>
            <p className='mt-1 text-xs text-foreground/70 break-words'>{metric.error}</p>
          </div>
          )
        : (
          <>
            {headline && (
              <div className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
                <span className='text-2xl font-semibold tabular-nums text-foreground'>{fmt.value(headline.value, headlineUnit(metric))}</span>
                <HeadlineChange value={headline.value} previous={headline.previous} unit={headlineUnit(metric)} goodDirection={headlineDirection(metric)} />
                {periodLabel && <span className='text-xs text-foreground/50'>{periodLabel}</span>}
                {comparison && <ComparisonHeadline metric={metric} headline={headline} comparison={comparison} className='basis-full' />}
              </div>
            )}
            <MetricBody metric={metric} comparison={comparison} />
            {metric.display !== 'kpi' && metric.data?.note && (
              <p className='text-xs text-foreground/60' data-testid='data-note'>{metric.data.note}</p>
            )}
          </>
          )}
    </article>
  )
}
