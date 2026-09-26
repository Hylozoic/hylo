import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import Loading from 'components/Loading'
import { Switch } from 'components/ui/switch'
import { cn } from 'util/index'
import { useFormat } from './format'
import MetricCard, { ComparisonHeadline, MetricBody, headlineDirection, headlineUnit, metricHeadline, usePeriodLabel } from './MetricCard'
import VitalTile from './VitalTile'
import HeadlineChange from './HeadlineChange'
import { COMPARE_PERIODS, DEFAULT_COMPARE_PERIOD, comparisonAsOf, comparisonMetric, comparisonMetricMap } from './compare'

export const POLL_INTERVAL_MS = 3000
const ENDPOINT = '/noo/admin/platform-health'
const DATE_INPUT = /^\d{4}-\d{2}-\d{2}$/
// The server rejects requests without this header, so a cross-site page cannot start an expensive run
export const REQUEST_HEADERS = { 'X-Requested-With': 'hylo-admin' }

export function platformHealthUrl (asOf, refresh) {
  const params = new URLSearchParams()
  if (asOf && DATE_INPUT.test(asOf)) params.set('asOf', asOf)
  if (refresh) params.set('refresh', '1')
  const query = params.toString()
  return query ? `${ENDPOINT}?${query}` : ENDPOINT
}

function todayIso () {
  return new Date().toISOString().slice(0, 10)
}

// The server names the computation holding its lock by the normalized as-of time, or 'live'
function computationName (asOf) {
  return asOf ? `${asOf}T00:00:00.000Z` : 'live'
}

const IDLE = { phase: 'idle', data: null, error: null, startedAt: null, waiting: false, forAsOf: null }

/**
 * Loads the panel, polling while the server computes it. Returns { phase, data, error, startedAt, waiting, forAsOf, reload }.
 * phase: 'idle' | 'loading' | 'computing' | 'ready' | 'error'; waiting is true while the server is busy
 * with another date's computation (startedAt is then null); forAsOf is the date the state belongs to.
 * Each load supersedes the previous one: its request is aborted and its polling stops, so a stale
 * response can never overwrite a newer one. Unmounting, or `enabled` turning false, stops everything.
 */
function usePlatformHealth (asOf, enabled = true) {
  const { t } = useFormat()
  const [state, setState] = useState(() => (enabled ? { ...IDLE, phase: 'loading', forAsOf: asOf } : IDLE))
  const requestRef = useRef(0)
  const timerRef = useRef(null)
  const controllerRef = useRef(null)

  const cancel = useCallback(() => {
    requestRef.current++
    clearTimeout(timerRef.current)
    timerRef.current = null
    if (controllerRef.current) controllerRef.current.abort()
    controllerRef.current = null
  }, [])

  const load = useCallback((refresh = false, keepData = false) => {
    cancel()
    const requestId = requestRef.current
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    controllerRef.current = controller
    const isCurrent = () => requestId === requestRef.current
    setState(prev => ({ ...IDLE, phase: 'loading', data: keepData ? prev.data : null, forAsOf: asOf }))

    const run = withRefresh => {
      if (!isCurrent()) return
      fetch(platformHealthUrl(asOf, withRefresh), {
        credentials: 'include',
        headers: REQUEST_HEADERS,
        signal: controller ? controller.signal : undefined
      })
        .then(res => res.json().catch(() => ({})).then(body => ({ res, body })))
        .then(({ res, body }) => {
          if (!isCurrent()) return
          if (res.status === 202 || body?.status === 'computing') {
            const running = body?.busyWith === computationName(asOf)
            const waiting = !!body?.busyWith && !running
            setState(prev => ({ ...prev, phase: 'computing', error: null, waiting, startedAt: waiting ? null : (body?.startedAt || prev.startedAt) }))
            // The server only clears a date's cached result or error once that date's own computation
            // starts, so a refresh is repeated until then; polling without it would get the old result back
            timerRef.current = setTimeout(() => run(withRefresh && !running), POLL_INTERVAL_MS)
            return
          }
          if (res.ok && body?.status === 'ready') {
            setState({ ...IDLE, phase: 'ready', data: body, forAsOf: asOf })
            return
          }
          setState(prev => ({ ...prev, phase: 'error', waiting: false, error: body?.error || t('Server returned {{status}}', { status: res.status }) }))
        })
        .catch(err => {
          if (!isCurrent()) return
          setState(prev => ({ ...prev, phase: 'error', waiting: false, error: err.message }))
        })
    }
    run(refresh)
  }, [asOf, t, cancel])

  useEffect(() => {
    if (!enabled) {
      setState(IDLE)
      return undefined
    }
    load(false, false)
    return cancel
  }, [enabled, load, cancel])

  return { ...state, reload: load }
}

function ElapsedSince ({ startedAt }) {
  const { t } = useFormat()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const started = startedAt ? new Date(startedAt).getTime() : NaN
  if (Number.isNaN(started)) return null
  const seconds = Math.max(0, Math.round((now - started) / 1000))
  return <span>{t('Started {{seconds}} s ago', { seconds })}</span>
}

// While the server computes another date, its start time says nothing about this one
function Progress ({ startedAt, waiting }) {
  const { t } = useFormat()
  return waiting ? <span>{t('Waiting for another computation to finish')}</span> : <ElapsedSince startedAt={startedAt} />
}

// The ticking elapsed time sits outside the live region, so it isn't announced every second
function ComputingNotice ({ startedAt, waiting, compact }) {
  const { t } = useFormat()
  return (
    <div
      className={cn('rounded-lg border border-foreground/10 bg-card text-foreground', compact ? 'p-3 text-sm' : 'p-6')}
      data-testid='computing-state'
    >
      <div role='status' aria-live='polite'>
        <p className={cn('font-medium', { 'text-lg': !compact })}>{t('Computing the panel — this takes about a minute')}</p>
        <p className='mt-1 text-sm text-foreground/60'>{t('You can leave this page open; it will update when the numbers are ready.')}</p>
        {waiting && <p className='text-sm text-foreground/60'>{t('Waiting for another computation to finish')}</p>}
      </div>
      {!waiting && (
        <p className='text-sm text-foreground/60'>
          <ElapsedSince startedAt={startedAt} />
        </p>
      )}
      <div className='mt-3 h-1 w-full overflow-hidden rounded-full bg-foreground/10' aria-hidden='true'>
        <div className='h-full w-1/3 rounded-full bg-focus motion-safe:animate-pulse' />
      </div>
    </div>
  )
}

function ErrorNotice ({ error, onRetry }) {
  const { t } = useFormat()
  return (
    <div role='alert' className='rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm' data-testid='panel-error'>
      <p className='font-medium text-red-700 dark:text-red-400'>{t('The panel could not be loaded.')}</p>
      <p className='mt-1 text-foreground/70 break-words'>{error}</p>
      <button
        type='button'
        onClick={onRetry}
        className='mt-3 rounded-md border border-foreground/20 px-3 py-1 text-foreground hover:bg-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
      >
        {t('Retry')}
      </button>
    </div>
  )
}

function NorthStarHero ({ northStar, metric, comparison }) {
  const fmt = useFormat()
  const { t } = fmt
  const headline = metric && !metric.error ? metricHeadline(metric) : null
  const periodLabel = usePeriodLabel(metric, headline)

  return (
    <section
      aria-labelledby='platform-health-north-star'
      className='rounded-xl border border-foreground/15 bg-card p-5 shadow-md'
      data-testid='north-star'
    >
      <p className='text-xs font-semibold uppercase tracking-wide text-foreground/50'>{t('North star')}</p>
      <div className='mt-1 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'>
        <div className='space-y-3'>
          <h2 id='platform-health-north-star' className='text-xl font-bold text-foreground'>{northStar.name}</h2>
          {headline && (
            <div className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
              <span className='text-4xl font-semibold tabular-nums text-foreground'>{fmt.value(headline.value, headlineUnit(metric))}</span>
              <HeadlineChange value={headline.value} previous={headline.previous} unit={headlineUnit(metric)} goodDirection={headlineDirection(metric)} />
              {periodLabel && <span className='text-xs text-foreground/50'>{periodLabel}</span>}
              {comparison && <ComparisonHeadline metric={metric} headline={headline} comparison={comparison} className='basis-full' />}
            </div>
          )}
          {northStar.definition && <p className='text-sm text-foreground/80 whitespace-pre-line'>{northStar.definition}</p>}
          {northStar.why && (
            <div className='text-sm text-foreground/70'>
              <h3 className='font-semibold text-foreground'>{t('Why this is our north star')}</h3>
              <p className='whitespace-pre-line'>{northStar.why}</p>
            </div>
          )}
        </div>
        <div className='min-w-0'>
          {metric?.error && (
            <p className='text-sm text-red-700 dark:text-red-400'>{t('This metric could not be computed.')} {metric.error}</p>
          )}
          {metric && !metric.error && metric.display === 'series' && (
            <MetricBody metric={{ ...metric, label: northStar.name || metric.label }} variant='hero' comparison={comparison} />
          )}
          {metric && !metric.error && metric.display !== 'series' && <MetricBody metric={metric} comparison={comparison} />}
        </div>
      </div>
    </section>
  )
}

const LONG_DATE = { year: 'numeric', month: 'long', day: 'numeric' }

// The live region stays mounted while comparing is off, so its first message is announced when it is
// turned on; the ticking elapsed time and the Retry button sit outside it
function ComparisonStatus ({ on, date, weeks, phase, error, startedAt, waiting, onRetry }) {
  const fmt = useFormat()
  const { t } = fmt
  const shownDate = fmt.date(date, LONG_DATE)
  let message = t('Loading the comparison with {{date}}…', { date: shownDate })
  if (phase === 'ready') message = t('Compared with {{date}} ({{weeks}} weeks earlier)', { date: shownDate, weeks })
  if (phase === 'error') message = <span className='text-red-700 dark:text-red-400 break-words'>{t('The comparison could not be loaded: {{error}}', { error })}</span>

  return (
    <div className={cn('max-w-2xl', { 'mt-1 space-y-0.5': on })}>
      <div className='flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-foreground/70'>
        <div role='status' aria-live='polite'>
          {on && <div data-testid='comparison-status'><span>{message}</span></div>}
        </div>
        {on && phase === 'error' && (
          <button
            type='button'
            onClick={onRetry}
            className='rounded-md border border-foreground/20 px-2 py-0.5 text-xs text-foreground hover:bg-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
          >
            {t('Retry')}
          </button>
        )}
        {on && phase === 'computing' && <span className='text-xs'><Progress startedAt={startedAt} waiting={waiting} /></span>}
      </div>
      {on && (
        <p className='text-xs text-foreground/70' data-testid='comparison-caveat'>
          {t("Earlier periods are recomputed from today's data, so posts and accounts deleted since then are left out. Point-in-time and notification-based numbers, such as DAU, WAU and MAU, can't be rebuilt for past dates and show as not available.")}
        </p>
      )}
    </div>
  )
}

function CompareControls ({ on, onToggle, period, periodOptions, onPeriodChange }) {
  const { t } = useFormat()
  const switchId = useId()
  return (
    <div className='flex flex-wrap items-end gap-2 lg:justify-end'>
      <div className='flex items-center gap-2 py-1.5'>
        <Switch id={switchId} checked={on} onCheckedChange={onToggle} data-testid='compare-toggle' />
        <label htmlFor={switchId} className='cursor-pointer whitespace-nowrap text-sm text-foreground/80'>{t('Compare to historical data')}</label>
      </div>
      {on && (
        <label className='flex flex-col text-xs text-foreground/60'>
          {t('Compare with')}
          <select
            value={period}
            onChange={event => onPeriodChange(event.target.value)}
            className='mt-1 rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm text-foreground'
            data-testid='compare-period'
          >
            {periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}

function PanelHeader ({ data, dateInput, onDateInputChange, onApplyDate, canApplyDate, showBackToToday, onBackToToday, onRefresh, busy, compare }) {
  const fmt = useFormat()
  const { t } = fmt
  const shownAsOf = data?.asOf ? fmt.date(data.asOf, LONG_DATE) : null
  const { onToggle, onPeriodChange, onRetry } = compare

  return (
    <header className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
      <div className='min-w-0'>
        <h1 className='text-2xl font-bold text-foreground'>{t('Platform health')}</h1>
        {shownAsOf && <p className='text-sm text-foreground/70'>{t('Showing data as of {{date}}', { date: shownAsOf })}</p>}
        <ComparisonStatus
          on={compare.on}
          date={compare.date}
          weeks={compare.weeks}
          phase={compare.phase}
          error={compare.error}
          startedAt={compare.startedAt}
          waiting={compare.waiting}
          onRetry={onRetry}
        />
        {data?.generatedAt && (
          <p className='text-xs text-foreground/50'>
            {t('Generated {{time}}', { time: fmt.dateTime(data.generatedAt) })}
            {data.cached && (
              <span className='ml-2 rounded-full border border-foreground/20 px-2 py-0.5 text-2xs uppercase tracking-wide' data-testid='cached-badge'>
                {t('Cached')}
              </span>
            )}
          </p>
        )}
      </div>
      <div className='flex flex-col gap-2 lg:shrink-0 lg:items-end'>
        <div className='flex flex-wrap items-end gap-2 lg:justify-end'>
          <form
            className='flex flex-wrap items-end gap-2'
            onSubmit={event => {
              event.preventDefault()
              onApplyDate()
            }}
            data-testid='as-of-form'
          >
            <label className='flex flex-col text-xs text-foreground/60'>
              {t('View a past date')}
              <input
                type='date'
                value={dateInput}
                max={todayIso()}
                onChange={onDateInputChange}
                className='mt-1 rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm text-foreground'
              />
            </label>
            <button
              type='submit'
              disabled={!canApplyDate}
              className='rounded-md border border-foreground/20 px-3 py-1.5 text-sm text-foreground hover:bg-foreground/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
            >
              {t('View date')}
            </button>
            {showBackToToday && (
              <button
                type='button'
                onClick={onBackToToday}
                className='rounded-md px-3 py-1.5 text-sm text-foreground/80 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
              >
                {t('Back to today')}
              </button>
            )}
          </form>
          <button
            type='button'
            onClick={onRefresh}
            disabled={busy}
            className='inline-flex items-center gap-1.5 rounded-md border border-foreground/20 px-3 py-1.5 text-sm text-foreground hover:bg-foreground/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
          >
            <RefreshCw className={cn('w-4 h-4', { 'motion-safe:animate-spin': busy })} aria-hidden='true' />
            {t('Refresh')}
          </button>
        </div>
        <CompareControls
          on={compare.on}
          onToggle={onToggle}
          period={compare.period}
          periodOptions={compare.periodOptions}
          onPeriodChange={onPeriodChange}
        />
      </div>
    </header>
  )
}

/**
 * Admin panel for platform health: north star, vital signs, sections of metric cards, and the
 * metrics we deliberately don't optimize or can't measure yet. Fetches GET /noo/admin/platform-health.
 */
export default function PlatformHealth () {
  const fmt = useFormat()
  const { t } = fmt
  // asOf is the applied date ('' means today); dateDraft is what the date input holds until it is applied
  const [asOf, setAsOf] = useState('')
  const [dateDraft, setDateDraft] = useState(null)
  const { phase, data, error, startedAt, waiting, reload } = usePlatformHealth(asOf)

  const appliedDate = asOf || (data?.asOf ? String(data.asOf).slice(0, 10) : '')
  const dateInput = dateDraft ?? appliedDate
  const canApplyDate = DATE_INPUT.test(dateInput) && dateInput <= todayIso() && dateInput !== appliedDate

  const onDateInputChange = event => setDateDraft(event.target.value)
  const onApplyDate = () => {
    if (!canApplyDate) return
    setAsOf(dateInput)
    setDateDraft(null)
  }
  const onBackToToday = () => {
    setAsOf('')
    setDateDraft(null)
  }
  const onRefresh = () => reload(true, true)
  const busy = phase === 'loading' || phase === 'computing'

  const [compareOn, setCompareOn] = useState(false)
  const [comparePeriod, setComparePeriod] = useState(DEFAULT_COMPARE_PERIOD)
  // The date of the numbers shown, so a live panel still on screen after midnight UTC keeps its comparison
  const comparisonDate = comparisonAsOf(appliedDate || todayIso(), comparePeriod)
  const earlier = usePlatformHealth(comparisonDate, compareOn)
  // The earlier panel's state can still belong to the previous comparison date until its new load starts
  const earlierIsCurrent = compareOn && earlier.forAsOf === comparisonDate
  const earlierMetrics = useMemo(() => comparisonMetricMap(earlier.data), [earlier.data])
  const periodOptions = useMemo(() => [
    { value: '1y', label: t('1 year earlier') },
    { value: '6m', label: t('6 months earlier') }
  ], [t])
  const periodLabel = periodOptions.find(option => option.value === comparePeriod)?.label
  const comparisonReady = earlierIsCurrent && earlier.phase === 'ready'
  const currentLabel = asOf ? fmt.date(asOf) : t('Now')
  const comparisonFor = metric => (comparisonReady && metric
    ? { period: comparePeriod, label: periodLabel, currentLabel, metric: comparisonMetric(earlierMetrics, metric) }
    : undefined)
  const compare = {
    on: compareOn,
    onToggle: checked => setCompareOn(!!checked),
    period: comparePeriod,
    periodOptions,
    onPeriodChange: setComparePeriod,
    date: comparisonDate,
    weeks: COMPARE_PERIODS[comparePeriod].days / 7,
    phase: earlierIsCurrent && earlier.phase !== 'idle' ? earlier.phase : 'loading',
    error: earlier.error,
    startedAt: earlier.startedAt,
    waiting: earlier.waiting,
    onRetry: () => earlier.reload(true, false)
  }

  const allMetrics = useMemo(() => (data?.sections || []).flatMap(section => section.metrics || []), [data])
  const northStarId = data?.northStar?.metricId
  // The north star already has the hero card, so it is not repeated among the vital signs (its card stays in its section)
  const vitals = allMetrics.filter(metric => metric.vital && !(northStarId && metric.id === northStarId))
  const northStarMetric = data?.northStar ? allMetrics.find(metric => metric.id === data.northStar.metricId) : null

  return (
    <div className='h-full overflow-y-auto'>
      <div className='mx-auto max-w-screen-2xl space-y-8 p-4 sm:p-6'>
        <PanelHeader
          data={data}
          dateInput={dateInput}
          onDateInputChange={onDateInputChange}
          onApplyDate={onApplyDate}
          canApplyDate={canApplyDate}
          showBackToToday={!!asOf}
          onBackToToday={onBackToToday}
          onRefresh={onRefresh}
          busy={busy}
          compare={compare}
        />

        {!data && phase === 'loading' && <Loading />}
        {phase === 'computing' && <ComputingNotice startedAt={startedAt} waiting={waiting} compact={!!data} />}
        {phase === 'error' && <ErrorNotice error={error} onRetry={() => reload(true, true)} />}

        {data && (
          <div className={cn('space-y-10', { 'opacity-60 transition-opacity motion-reduce:transition-none': busy })} aria-busy={busy}>
            {data.northStar && <NorthStarHero northStar={data.northStar} metric={northStarMetric} comparison={comparisonFor(northStarMetric)} />}

            {vitals.length > 0 && (
              <section aria-labelledby='platform-health-vitals'>
                <h2 id='platform-health-vitals' className='mb-3 text-lg font-semibold text-foreground'>{t('Vital signs')}</h2>
                <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
                  {vitals.map(metric => <VitalTile key={metric.id} metric={metric} comparison={comparisonFor(metric)} />)}
                </div>
              </section>
            )}

            {(data.sections || []).map(section => (
              <section key={section.id} aria-labelledby={`section-${section.id}`} data-testid={`section-${section.id}`}>
                <div className='mb-4 border-b border-foreground/10 pb-2'>
                  <h2 id={`section-${section.id}`} className='text-lg font-semibold text-foreground'>{section.title}</h2>
                  {section.question && <p className='text-sm text-foreground/60'>{section.question}</p>}
                </div>
                <div className='grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3'>
                  {(section.metrics || []).map(metric => <MetricCard key={metric.id} metric={metric} comparison={comparisonFor(metric)} />)}
                </div>
              </section>
            ))}

            {data.antiMetrics?.length > 0 && (
              <section aria-labelledby='platform-health-anti-metrics'>
                <h2 id='platform-health-anti-metrics' className='mb-1 text-lg font-semibold text-foreground'>{t("What we don't optimize")}</h2>
                <p className='mb-3 text-sm text-foreground/60'>{t('Numbers that are easy to grow but mislead about the health of the network.')}</p>
                <ul className='list-disc space-y-2 pl-5 text-sm text-foreground/80'>
                  {data.antiMetrics.map((item, idx) => <li key={idx}>{item}</li>)}
                </ul>
              </section>
            )}

            {data.instrumentationGaps?.length > 0 && (
              <section aria-labelledby='platform-health-gaps'>
                <h2 id='platform-health-gaps' className='mb-1 text-lg font-semibold text-foreground'>{t("What we can't measure yet")}</h2>
                <p className='mb-3 text-sm text-foreground/60'>{t('Data we would need to capture to answer these questions well.')}</p>
                <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
                  {data.instrumentationGaps.map((gap, idx) => (
                    <div key={`${gap.name}-${idx}`} className='rounded-lg border border-foreground/10 bg-card p-4 text-sm'>
                      <h3 className='font-semibold text-foreground'>{gap.name}</h3>
                      {gap.why && (
                        <p className='mt-1 text-foreground/80'><span className='font-medium text-foreground'>{t('Why it matters')}:</span> {gap.why}</p>
                      )}
                      {gap.capture && (
                        <p className='mt-1 text-foreground/80'><span className='font-medium text-foreground'>{t('What to capture')}:</span> {gap.capture}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
