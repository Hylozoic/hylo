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

const PERIODS = [
  { id: 'day', label: 'Daily', metrics: ['active_users', 'wau', 'mau', 'contributors', 'posts', 'comments', 'joins'] },
  { id: 'week', label: 'Weekly', metrics: ['active_users', 'contributors', 'connected_members', 'posts', 'comments', 'reactions', 'joins', 'contributor_cohort', 'contributor_retained'] },
  { id: 'month', label: 'Monthly', metrics: ['active_users', 'contributors', 'connected_members', 'posts', 'comments', 'joins'] }
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

/** UTC day some days before today. */
function daysAgo (days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

/** How far back each period toggle looks. */
function rangeFor (period) {
  const to = new Date().toISOString().slice(0, 10)
  if (period === 'day') return { from: daysAgo(30), to }
  if (period === 'week') return { from: daysAgo(26 * 7), to }
  return { from: daysAgo(365 * 2), to }
}

/** The latest number in a series, skipping periods that were never computed. */
function latest (series, metric) {
  const points = (series.find(item => item.metric === metric) || {}).points || []
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].value !== null) return points[i].value
  }
  return null
}

/** A single line. Null values break the line instead of being drawn as zero. */
function LineChart ({ points }) {
  const values = points.map(point => point.value).filter(value => value !== null)
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const width = 520
  const height = 120
  const step = width / Math.max(points.length - 1, 1)
  let path = ''
  let drawing = false
  points.forEach((point, index) => {
    if (point.value === null) {
      drawing = false
      return
    }
    const x = (index * step).toFixed(1)
    const y = (height - (point.value / max) * (height - 8) - 4).toFixed(1)
    path += `${drawing ? 'L' : 'M'}${x},${y}`
    drawing = true
  })
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className='w-full h-28' role='img'>
      <path d={path} fill='none' stroke='hsl(var(--focus))' strokeWidth='2' />
    </svg>
  )
}

/** One metric: its latest value and the series behind it. */
function MetricCard ({ label, value, points, note }) {
  return (
    <div className='rounded-lg border border-foreground/10 bg-card p-3'>
      <div className='text-xs text-foreground/60'>{label}</div>
      <div className='text-2xl font-semibold text-foreground'>{value === null ? '—' : Math.round(value).toLocaleString()}</div>
      {note && <div className='text-xs text-foreground/60 mb-1'>{note}</div>}
      <LineChart points={points || []} />
    </div>
  )
}

/**
 * Charts of stored platform or group metrics. Pass a groupId for one group,
 * or leave it out for the whole platform.
 */
export default function MetricsPanel ({ groupId, signupMetric = false }) {
  const { t } = useTranslation()
  const [period, setPeriod] = useState('week')
  const [series, setSeries] = useState(null)
  const [error, setError] = useState(null)

  const choice = PERIODS.find(item => item.id === period)
  const metrics = signupMetric ? choice.metrics.concat('signups') : choice.metrics

  useEffect(() => {
    let cancelled = false
    const { from, to } = rangeFor(period)
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
  }, [groupId, period, signupMetric])

  const pointsFor = metric => (series || []).find(item => item.metric === metric)?.points || []
  const cohort = latest(series || [], 'contributor_cohort')
  const retained = latest(series || [], 'contributor_retained')
  const retention = cohort ? Math.round((retained || 0) / cohort * 100) : null

  return (
    <div className='p-4 max-w-5xl'>
      <div className='flex gap-2 mb-4'>
        {PERIODS.map(item => (
          <button
            key={item.id}
            type='button'
            onClick={() => setPeriod(item.id)}
            className={period === item.id
              ? 'px-3 py-1 rounded-md bg-foreground text-background text-sm'
              : 'px-3 py-1 rounded-md border border-foreground/20 text-foreground text-sm'}
          >
            {t(item.label)}
          </button>
        ))}
      </div>
      <p className='text-sm text-foreground/60 mb-4'>
        {t('Activity is recorded as it happens. Older weeks fill in after the history backfill, and visits start the day this ships.')}
      </p>
      {error && <p className='text-sm text-accent mb-3'>{error}</p>}
      {!series && <Loading />}
      {series && (
        <>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            {metrics.filter(metric => LABELS[metric] || metric === 'signups').map(metric => (
              <MetricCard
                key={metric}
                label={t(metric === 'signups' ? 'Signups' : LABELS[metric])}
                value={latest(series, metric)}
                points={pointsFor(metric)}
              />
            ))}
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
