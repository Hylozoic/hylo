import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { queryHyloAPI } from 'util/graphql'
import Loading from 'components/Loading'

const PLATFORM_QUERY = `query PlatformMetrics($metrics: [String]!, $period: String!, $from: String!, $to: String!) {
  platformMetrics(metrics: $metrics, period: $period, from: $from, to: $to) {
    metric
    points { periodStart value }
  }
}`

const GROUP_QUERY = `query GroupMetrics($id: ID!, $metrics: [String]!, $period: String!, $from: String!, $to: String!) {
  group(id: $id) {
    metrics(metrics: $metrics, period: $period, from: $from, to: $to) {
      metric
      points { periodStart value }
    }
  }
}`

const METRICS = ['active_users', 'contributors', 'connected_members', 'posts', 'comments', 'reactions', 'joins']

const RANGES = [
  { id: '7D', label: '7D', period: 'day' },
  { id: '30D', label: '30D', period: 'day' },
  { id: '3M', label: '3M', period: 'week' },
  { id: '6M', label: '6M', period: 'month' },
  { id: '12M', label: '12M', period: 'month' }
]

const LABELS = {
  active_users: 'Active people',
  wau: 'Weekly active people',
  mau: 'Monthly active people',
  contributors: 'Contributors',
  connected_members: 'Connected members',
  posts: 'Posts',
  comments: 'Comments',
  reactions: 'Reactions',
  joins: 'New members'
}

const EXPLAINERS = {
  active_users: 'Distinct people who visited.',
  contributors: 'Distinct people who posted, commented, reacted, RSVPed, voted, or joined a project.',
  connected_members: 'Distinct people on either side of a comment, reaction, RSVP, vote, or project join.',
  posts: 'Posts that were created.',
  comments: 'Comments that were written.',
  reactions: 'Reactions that were added.',
  joins: 'People who joined a group.',
  signups: 'Accounts that were created.'
}

const COMPARE_LABELS = {
  '7D': 'Previous week',
  '30D': 'Previous month',
  '3M': 'Previous year',
  '6M': 'Previous year',
  '12M': 'Previous year'
}

const COMPARE_NOTES = {
  '7D': 'The dotted line is the same count from the week before.',
  '30D': 'The dotted line is the same count from the month before.',
  '3M': 'The dotted line is the same count from the year before.',
  '6M': 'The dotted line is the same count from the year before.',
  '12M': 'The dotted line is the same count from the year before.'
}

const RANGE_NOTES = {
  '7D': 'Each point is the count for one day, over the last 7 days. Dates run left to right and the scale is the count.',
  '30D': 'Each point is the count for one day, over the last 30 days. Dates run left to right and the scale is the count.',
  '3M': 'Each point is the count for one week, over the last 3 months. Dates run left to right and the scale is the count.',
  '6M': 'Each point is the count for one month, over the last 6 months. Dates run left to right and the scale is the count.',
  '12M': 'Each point is the count for one month, over the last 12 months. Dates run left to right and the scale is the count.'
}

/** UTC calendar day as YYYY-MM-DD. */
function utcDay (date) {
  return date.toISOString().slice(0, 10)
}

/**
 * 7D and 30D are daily points, 3M is weekly points, 6M and 12M are monthly
 * points. `to` is today, and the month ranges start on the first of the month.
 */
function rangeFor (rangeId) {
  const today = new Date()
  const to = utcDay(today)
  if (rangeId === '7D' || rangeId === '30D') {
    const from = new Date(today.getTime())
    from.setUTCDate(from.getUTCDate() - (rangeId === '7D' ? 6 : 29))
    return { from: utcDay(from), to }
  }
  if (rangeId === '3M') {
    const from = new Date(today.getTime())
    from.setUTCMonth(from.getUTCMonth() - 3)
    return { from: utcDay(from), to }
  }
  const monthsBack = rangeId === '6M' ? 5 : 11
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsBack, 1))
  return { from: utcDay(from), to }
}

/** Monday for a week, or the first of the month, so it matches the stored snapshot. */
function alignStart (day, period) {
  const date = new Date(`${day}T00:00:00Z`)
  if (period === 'week') {
    const weekday = date.getUTCDay()
    date.setUTCDate(date.getUTCDate() - (weekday === 0 ? 6 : weekday - 1))
  } else if (period === 'month') {
    date.setUTCDate(1)
  }
  return utcDay(date)
}

/** The same point in the comparison window: a week, a month, or a year earlier. */
function shiftStart (day, rangeId) {
  const date = new Date(`${day}T00:00:00Z`)
  if (rangeId === '7D') date.setUTCDate(date.getUTCDate() - 7)
  else if (rangeId === '30D') date.setUTCDate(date.getUTCDate() - 30)
  else if (rangeId === '3M') date.setUTCDate(date.getUTCDate() - 364)
  else date.setUTCFullYear(date.getUTCFullYear() - 1)
  return utcDay(date)
}

/** Fetches the displayed window plus the earlier window the dotted line compares against. */
function queryRange (rangeId) {
  const display = rangeFor(rangeId)
  const period = RANGES.find(item => item.id === rangeId).period
  return { from: shiftStart(alignStart(display.from, period), rangeId), to: display.to }
}

/**
 * Keeps the points in the selected window and attaches the matching earlier
 * value, looked up from the longer series the query returned.
 */
function chartPoints (points, rangeId, period) {
  const start = alignStart(rangeFor(rangeId).from, period)
  const byDay = new Map((points || []).map(point => [String(point.periodStart).slice(0, 10), point.value]))
  return (points || [])
    .filter(point => String(point.periodStart).slice(0, 10) >= start)
    .map(point => {
      const periodStart = String(point.periodStart).slice(0, 10)
      const previousStart = shiftStart(periodStart, rangeId)
      return {
        periodStart,
        value: point.value,
        previousStart,
        previous: byDay.has(previousStart) ? byDay.get(previousStart) : null
      }
    })
}

/** The newest stored value in the visible window, skipping periods that were never computed. */
function latestValue (points) {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].value !== null) return points[i]
  }
  return null
}

/** A short date for an axis tick. Months include the year so "Oct '26" is not read as October 26. */
function formatTick (periodStart, period) {
  const date = new Date(`${periodStart}T00:00:00Z`)
  if (period === 'month') {
    const month = date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
    return `${month} '${String(date.getUTCFullYear()).slice(2)}`
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** The period the headline number belongs to. */
function formatWhen (periodStart, period) {
  const date = new Date(`${periodStart}T00:00:00Z`)
  if (period === 'month') return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return formatTick(periodStart, 'day')
}

/** A calendar day, with the year when the popup needs it. */
function formatDay (date, withYear) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC'
  })
}

/** The day, week, or month a point covers. Weeks and months are shown as a range. */
function periodRange (periodStart, period) {
  const start = new Date(`${periodStart}T00:00:00Z`)
  if (period === 'day') return formatDay(start, true)
  const end = new Date(start.getTime())
  if (period === 'week') {
    end.setUTCDate(end.getUTCDate() + 6)
  } else {
    end.setUTCMonth(start.getUTCMonth() + 1, 0)
  }
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  return `${formatDay(start, !sameYear)} – ${formatDay(end, true)}`
}

/** Whole-number axis labels, without a trailing .0 from a half step. */
function formatCount (value) {
  return Math.round(value).toLocaleString()
}

/** The vertical scale: the max, the middle, and zero, with duplicates removed. */
function yTicks (max) {
  return [...new Set([max, max / 2, 0].map(value => Math.round(value)))]
}

/** Which points get a date label. Short series are named in full. Longer ones get four labels. */
function labeledIndexes (count) {
  if (count <= 8) return Array.from({ length: count }, (_, index) => index)
  const step = Math.ceil((count - 1) / 3)
  const indexes = []
  for (let index = 0; index < count; index += step) indexes.push(index)
  if (indexes[indexes.length - 1] !== count - 1) indexes.push(count - 1)
  return indexes
}

/** Connects the non-null values of one series. A missing value breaks the line. */
function linePath (points, valueKey, xAt, yAt) {
  let path = ''
  let drawing = false
  points.forEach((point, index) => {
    const value = point[valueKey]
    if (value === null || value === undefined) {
      drawing = false
      return
    }
    path += `${drawing ? 'L' : 'M'}${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`
    drawing = true
  })
  return path
}

/** A line with a count scale and a date scale. Missing periods leave a gap. */
function LineChart ({ points, period, compare }) {
  const [hoverKey, setHoverKey] = useState(null)
  if (!points.length) return null
  const width = 520
  const height = 176
  const pad = { left: 44, right: 12, top: 12, bottom: 32 }
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const values = []
  points.forEach(point => {
    if (point.value !== null) values.push(point.value)
    if (compare && point.previous !== null && point.previous !== undefined) values.push(point.previous)
  })
  const max = Math.max(...values, 1)
  const step = points.length === 1 ? 0 : plotWidth / (points.length - 1)
  const xAt = index => pad.left + index * step
  const yAt = value => pad.top + plotHeight - (value / max) * plotHeight
  const path = linePath(points, 'value', xAt, yAt)
  const previousPath = compare ? linePath(points, 'previous', xAt, yAt) : ''
  const dots = []
  points.forEach((point, index) => {
    const hoverValue = point.value !== null ? point.value : (compare ? point.previous : null)
    if (hoverValue === null || hoverValue === undefined) return
    dots.push({
      x: xAt(index),
      y: yAt(point.value !== null ? point.value : point.previous),
      key: point.periodStart,
      value: point.value,
      previous: point.previous,
      previousStart: point.previousStart,
      hasValue: point.value !== null
    })
  })
  const hover = dots.find(dot => dot.key === hoverKey)
  const hoverShift = !hover
    ? null
    : hover.x > width * 0.75
      ? 'translate(-100%, calc(-100% - 8px))'
      : hover.x < width * 0.25
        ? 'translate(0, calc(-100% - 8px))'
        : 'translate(-50%, calc(-100% - 8px))'

  return (
    <div className='relative'>
      <svg viewBox={`0 0 ${width} ${height}`} className='w-full h-40 text-foreground/50' role='img'>
        {yTicks(max).map(tick => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke='currentColor'
              strokeOpacity='0.25'
            />
            <text x={pad.left - 6} y={yAt(tick) + 4} textAnchor='end' fontSize='12' fill='currentColor'>
              {formatCount(tick)}
            </text>
          </g>
        ))}
        {labeledIndexes(points.length).map(index => (
          <text
            key={points[index].periodStart}
            x={xAt(index)}
            y={height - 8}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            fontSize='11'
            fill='currentColor'
          >
            {formatTick(points[index].periodStart, period)}
          </text>
        ))}
        <path d={path} fill='none' stroke='hsl(var(--focus))' strokeWidth='2' />
        {previousPath && (
          <path d={previousPath} fill='none' stroke='hsl(var(--foreground))' strokeOpacity='0.7' strokeWidth='2' strokeDasharray='4 3' />
        )}
        {dots.map(dot => (
          <g key={dot.key}>
            {compare && dot.previous !== null && dot.previous !== undefined && (
              <circle cx={dot.x} cy={yAt(dot.previous)} r='3' fill='none' stroke='hsl(var(--foreground))' strokeOpacity='0.7' strokeWidth='1.5' />
            )}
            {dot.hasValue && (
              <circle cx={dot.x} cy={yAt(dot.value)} r={hoverKey === dot.key ? 5 : 3} fill='hsl(var(--focus))' />
            )}
            <circle
              cx={dot.x}
              cy={dot.y}
              r='14'
              fill='transparent'
              className='cursor-pointer'
              onMouseEnter={() => setHoverKey(dot.key)}
              onMouseLeave={() => setHoverKey(null)}
            />
          </g>
        ))}
      </svg>
      {hover && (
        <div
          className='pointer-events-none absolute z-10 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md'
          style={{
            left: `${(hover.x / width) * 100}%`,
            top: `${(hover.y / height) * 100}%`,
            transform: hoverShift
          }}
        >
          {hover.value !== null && (
            <>
              <div>{periodRange(hover.key, period)}</div>
              <div className='font-semibold'>{formatCount(hover.value)}</div>
            </>
          )}
          {compare && hover.previous !== null && hover.previous !== undefined && (
            <>
              <div className={hover.value !== null ? 'mt-1 opacity-80' : undefined}>
                {periodRange(hover.previousStart, period)}
              </div>
              <div className='font-semibold'>{formatCount(hover.previous)}</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** One metric: its latest value and the series behind it. */
function MetricCard ({ label, explainer, value, when, points, period, compare }) {
  return (
    <div className='rounded-lg border border-foreground/10 bg-card p-3'>
      <div className='text-xs text-foreground/60'>{label}</div>
      {explainer && <div className='text-xs text-foreground/50 mt-0.5 mb-1'>{explainer}</div>}
      <div className='text-2xl font-semibold text-foreground'>{value === null ? '—' : Math.round(value).toLocaleString()}</div>
      {when && <div className='text-xs text-foreground/60 mb-1'>{when}</div>}
      <LineChart points={points || []} period={period} compare={compare} />
    </div>
  )
}

/**
 * Charts of stored platform or group metrics. Pass a groupId for one group,
 * or leave it out for the whole platform.
 */
export default function MetricsPanel ({ groupId, signupMetric = false }) {
  const { t } = useTranslation()
  const [rangeId, setRangeId] = useState('30D')
  const [compare, setCompare] = useState(false)
  const [series, setSeries] = useState(null)
  const [error, setError] = useState(null)

  const choice = RANGES.find(item => item.id === rangeId)
  const period = choice.period
  const metrics = METRICS.concat(
    period === 'week' ? ['contributor_cohort', 'contributor_retained'] : [],
    signupMetric ? ['signups'] : []
  )

  useEffect(() => {
    let cancelled = false
    const { from, to } = queryRange(rangeId)
    setSeries(null)
    setError(null)
    const request = groupId
      ? queryHyloAPI({ query: GROUP_QUERY, variables: { id: groupId, metrics, period, from, to } })
      : queryHyloAPI({ query: PLATFORM_QUERY, variables: { metrics, period, from, to } })
    request.then(result => {
      if (cancelled) return
      const next = groupId ? result?.data?.group?.metrics : result?.data?.platformMetrics
      if (!next) {
        setError(result?.errors?.[0]?.message || t('Not enough activity in this period yet'))
        setSeries([])
        return
      }
      setSeries(next)
    }).catch(err => {
      if (!cancelled) {
        setError(err.message)
        setSeries([])
      }
    })
    return () => { cancelled = true }
  }, [groupId, rangeId, signupMetric])

  const pointsFor = metric => chartPoints(
    (series || []).find(item => item.metric === metric)?.points || [],
    rangeId,
    period
  )
  const cohort = latestValue(pointsFor('contributor_cohort'))
  const retained = latestValue(pointsFor('contributor_retained'))
  const retention = cohort ? Math.round((retained?.value || 0) / cohort.value * 100) : null

  return (
    <div className='p-4 max-w-5xl'>
      <div className='flex flex-wrap items-center gap-2 mb-4'>
        {RANGES.map(item => (
          <button
            key={item.id}
            type='button'
            onClick={() => setRangeId(item.id)}
            className={rangeId === item.id
              ? 'px-3 py-1 rounded-md bg-foreground text-background text-sm'
              : 'px-3 py-1 rounded-md border border-foreground/20 text-foreground text-sm'}
          >
            {t(item.label)}
          </button>
        ))}
        <button
          type='button'
          aria-pressed={compare}
          onClick={() => setCompare(value => !value)}
          className={compare
            ? 'ml-auto px-3 py-1 rounded-md bg-foreground text-background text-sm'
            : 'ml-auto px-3 py-1 rounded-md border border-dashed border-foreground/40 text-foreground text-sm'}
        >
          {t(COMPARE_LABELS[rangeId])}
        </button>
      </div>
      <p className='text-sm text-foreground/60 mb-4'>
        {t(RANGE_NOTES[rangeId])}
        {compare && ` ${t(COMPARE_NOTES[rangeId])}`}
      </p>
      {error && <p className='text-sm text-accent mb-3'>{error}</p>}
      {!series && <Loading />}
      {series && (
        <>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            {metrics.filter(metric => LABELS[metric] || metric === 'signups').map(metric => {
              const points = pointsFor(metric)
              const point = latestValue(points)
              const when = !point
                ? null
                : period === 'week'
                  ? t('Week of {{date}}', { date: formatWhen(point.periodStart, 'day') })
                  : formatWhen(point.periodStart, period)
              return (
                <MetricCard
                  key={metric}
                  label={t(metric === 'signups' ? 'Signups' : LABELS[metric])}
                  explainer={t(EXPLAINERS[metric])}
                  value={point ? point.value : null}
                  when={when}
                  points={points}
                  period={period}
                  compare={compare}
                />
              )
            })}
          </div>
          {period === 'week' && (
            <p className='text-sm text-foreground/70 mt-4'>
              {retention === null
                ? t('Not enough activity in this period yet')
                : t('Came back the next week') + `: ${retention}%`}
            </p>
          )}
        </>
      )}
    </div>
  )
}
