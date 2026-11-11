import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { queryHyloAPI } from 'util/graphql'
import Loading from 'components/Loading'
import { AVOID, GAPS, SECTIONS, VITAL, metricsForPeriod } from './metricsCatalog'

const PLATFORM_QUERY = `query PlatformMetrics($metrics: [String]!, $period: String!, $from: String!, $to: String!) {
  platformMetrics(metrics: $metrics, period: $period, from: $from, to: $to) {
    metric
    dimension
    points { periodStart value dimension }
  }
}`

const GROUP_QUERY = `query GroupMetrics($id: ID!, $metrics: [String]!, $period: String!, $from: String!, $to: String!) {
  group(id: $id) {
    metrics(metrics: $metrics, period: $period, from: $from, to: $to) {
      metric
      dimension
      points { periodStart value dimension }
    }
  }
}`

const PEOPLE_QUERY = `query MetricPeople($metric: String!, $groupId: ID, $period: String!, $periodStart: String!) {
  metricPeople(metric: $metric, groupId: $groupId, period: $period, periodStart: $periodStart) {
    people { id name avatarUrl count }
  }
}`

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
  joins: 'New members',
  signups: 'Signups'
}

const EXPLAINERS = {
  active_users: 'Distinct people who visited.',
  contributors: 'Distinct people who posted, commented, reacted, RSVPed, voted, or joined a project.',
  connected_members: 'Distinct people on either side of a comment, reaction, RSVP, vote, or project join.',
  posts: 'Posts that were created.',
  comments: 'Comments that were written.',
  reactions: 'Reactions that were added.',
  joins: 'People who joined a group.',
  signups: 'Accounts that were created.',
  stickiness: 'Daily active people divided by people active in the last 30 days.',
  contributors_30d: 'Distinct people who contributed in the last 30 days.',
  contributors_posting: 'Distinct people who posted or commented.',
  connected_beyond_reaction: 'People connected by a comment, RSVP, vote, or project join.',
  live_groups: 'Groups with at least 3 people posting or commenting in 28 days.',
  coordinating_members: 'People on either side of a connection on an event, request, offer, proposal, or project.',
  weekly_missed_connections: 'People none of whose posts that week were answered within 7 days.',
  feed_post_response_rate_7d: 'Feed posts that got a response within 7 days.',
  signup_joined_group_7d: 'New accounts that joined a group within 7 days.',
  signup_contributed_30d: 'New accounts that contributed within 30 days.',
  new_member_contributed_14d: 'New members who posted, commented, or reacted in that group within 14 days.',
  new_contributor_retention: 'First-time contributors who contributed again between day 8 and day 35.',
  account_deactivations: 'Accounts that were deactivated or deleted.',
  contributor_wow_retention: 'Of the people who contributed the week before, the share who contributed again this week.',
  live_group_survival: 'Live groups that were still live the following week.',
  connection_concentration: 'The share of connections that happened in the 10 most connected groups.',
  live_groups_linked: 'Live groups that are linked to another group.',
  multi_group_weavers: 'People who posted or commented in more than one group over 90 days.',
  where_connections_are_missed: 'The share of posts that went unanswered within 7 days, split by where they were.',
  after_a_missed_connection: 'People whose first post of the month was answered or missed, and who came back the next month.',
  new_groups_second_voice_30d: 'New groups that had a second person post or comment within 30 days.',
  invite_acceptance_14d: 'Invites, excluding bulk senders, that were accepted within 14 days.',
  groupless_active_users: 'People active in the last 30 days who belong to no group.',
  first_post_answered_7d: 'First posts that got a response within 7 days.',
  reciprocal_tie_members: 'People who both acted with the same other person in 90 days.',
  needs_answered_14d: 'Requests and offers that got a comment within 14 days.',
  events_that_gathered: 'Events with at least one RSVP from someone other than the host.',
  decisions_made: 'Proposals that got votes from at least two people.',
  projects_with_second_contributor: 'Projects that someone other than the author joined.',
  place_coverage_live_groups: 'Live groups that have a place set.',
  tended_groups_share: 'Groups whose steward visited in the last 30 days.',
  join_request_decision_time: 'Median hours from a join request to a decision.',
  join_requests_unanswered_7d: 'Join requests that were still open 7 days later.',
  stale_join_request_backlog: 'Join requests that have been waiting more than 7 days.',
  steward_coverage: 'Groups that have a steward.',
  moderation_health: 'Moderation items that are still open.',
  outbound_to_dormant_share: 'Yesterday\'s notifications sent to people with no visit in 30 days.',
  new_member_notification_turndown: 'New members who turned notifications down.',
  unsubscribe_all_leak: 'People whose email digest is set to never.',
  ignored_email_preferences: 'People who turned direct-message notifications off.',
  notification_pipeline_integrity: 'Notifications from yesterday that were not marked sent.',
  mixpanel_blind_spot: 'The share of people who opted out of analytics.',
  data_quality_tripwires: 'Checks that the stored numbers are complete and consistent.'
}

const HEALTH_LABELS = {
  stickiness: 'Stickiness',
  contributors_30d: 'Contributors in 30 days',
  contributors_posting: 'Posted or commented',
  connected_beyond_reaction: 'Connected by more than a reaction',
  live_groups: 'Live groups',
  coordinating_members: 'Coordinating members',
  weekly_missed_connections: 'Missed connections',
  feed_post_response_rate_7d: 'Posts answered in 7 days',
  signup_joined_group_7d: 'Joined a group in 7 days',
  signup_contributed_30d: 'Contributed in 30 days',
  new_member_contributed_14d: 'New members who contributed',
  new_contributor_retention: 'New contributors who returned',
  account_deactivations: 'Deactivated accounts',
  contributor_wow_retention: 'Came back the next week',
  live_group_survival: 'Live groups still live next week',
  connection_concentration: 'Connections in the busiest groups',
  live_groups_linked: 'Live groups linked to another',
  multi_group_weavers: 'People active in several groups',
  where_connections_are_missed: 'Where connections are missed',
  after_a_missed_connection: 'Coming back after a missed connection',
  new_groups_second_voice_30d: 'New groups with a second voice',
  invite_acceptance_14d: 'Invites accepted in 14 days',
  groupless_active_users: 'Active people without a group',
  first_post_answered_7d: 'First posts answered in 7 days',
  reciprocal_tie_members: 'People tied both ways',
  needs_answered_14d: 'Needs answered in 14 days',
  events_that_gathered: 'Events that gathered',
  decisions_made: 'Decisions made',
  projects_with_second_contributor: 'Projects with a second contributor',
  place_coverage_live_groups: 'Live groups with a place',
  tended_groups_share: 'Tended groups',
  join_request_decision_time: 'Time to decide a join request',
  join_requests_unanswered_7d: 'Join requests unanswered for 7 days',
  stale_join_request_backlog: 'Stale join requests',
  steward_coverage: 'Groups with a steward',
  moderation_health: 'Open moderation items',
  outbound_to_dormant_share: 'Mail sent to quiet people',
  new_member_notification_turndown: 'New members who turn notifications down',
  unsubscribe_all_leak: 'People who get no digest',
  ignored_email_preferences: 'People who turned off direct messages',
  notification_pipeline_integrity: 'Notifications that were not sent',
  mixpanel_blind_spot: 'People Mixpanel cannot see',
  data_quality_tripwires: 'Data quality checks',
  'Monthly active contributors': 'Monthly active contributors',
  'Weekly active contributors': 'Weekly active contributors'
}

const COMPARE_LABELS = {
  '7D': 'Previous week',
  '30D': 'Previous month',
  '3M': 'Previous year',
  '6M': 'Previous year',
  '12M': 'Previous year'
}

/** UTC calendar day as YYYY-MM-DD. */
function utcDay (date) {
  return date.toISOString().slice(0, 10)
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

/** The same point one comparison step earlier. Days step by the range. Weeks and months step by a year. */
function previousDay (day, period, rangeId) {
  const date = new Date(`${day}T00:00:00Z`)
  if (period === 'day') date.setUTCDate(date.getUTCDate() - (rangeId === '7D' ? 7 : 30))
  else if (period === 'week') date.setUTCDate(date.getUTCDate() - 364)
  else date.setUTCFullYear(date.getUTCFullYear() - 1)
  return utcDay(date)
}

/** The visible window for a period, plus the earlier stretch the dotted line reads. */
function queryWindow (period, rangeId) {
  const today = utcDay(new Date())
  let displayFrom
  if (period === 'day') {
    const start = new Date(`${today}T00:00:00Z`)
    start.setUTCDate(start.getUTCDate() - (rangeId === '7D' ? 6 : 29))
    displayFrom = utcDay(start)
  } else if (period === 'week') {
    const weeks = rangeId === '12M' ? 52 : rangeId === '6M' ? 26 : 16
    const start = new Date(`${alignStart(today, 'week')}T00:00:00Z`)
    start.setUTCDate(start.getUTCDate() - (weeks - 1) * 7)
    displayFrom = utcDay(start)
  } else {
    const months = rangeId === '12M' ? 11 : 5
    const now = new Date()
    displayFrom = utcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1)))
  }
  return { from: previousDay(displayFrom, period, rangeId), to: today, displayFrom }
}

/**
 * Keeps the points in the visible window and attaches the matching earlier
 * value, looked up from the longer series the query returned.
 */
function chartPoints (points, displayFrom, period, rangeId) {
  const byDay = new Map((points || []).map(point => [String(point.periodStart).slice(0, 10), point.value]))
  return (points || [])
    .filter(point => String(point.periodStart).slice(0, 10) >= displayFrom)
    .map(point => {
      const periodStart = String(point.periodStart).slice(0, 10)
      const previousStart = previousDay(periodStart, period, rangeId)
      return {
        periodStart,
        value: point.value,
        previousStart,
        previous: byDay.has(previousStart) ? byDay.get(previousStart) : null
      }
    })
}

/** Whether a change moved the way this metric wants, and by how much. */
function changeTone (current, previous) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null
  const delta = current - previous
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  return { delta, direction }
}

/** The share of one week's contributors who contributed again the next week. */
function retentionRates (cohortPoints, retainedPoints) {
  const retainedByDay = new Map((retainedPoints || []).map(point => [String(point.periodStart).slice(0, 10), point.value]))
  return (cohortPoints || []).map(point => {
    const periodStart = String(point.periodStart).slice(0, 10)
    const cohort = point.value
    const cameBack = retainedByDay.get(periodStart)
    return { periodStart, value: cohort ? (cameBack || 0) / cohort : null, dimension: '' }
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
function yTicks (max, unit) {
  if (unit === 'percent') return [1, 0.5, 0]
  return [...new Set([max, max / 2, 0].map(value => Math.round(value)))]
}

/** An axis label. Rates are percents; counts stay whole numbers. */
function formatAxis (value, unit) {
  if (unit === 'percent') return `${Math.round(value * 100)}%`
  return formatCount(value)
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

/** The visible marker for one reading. The main series is painted above a shared dot. */
function ChartDot ({ reading, x, hot }) {
  const radius = hot ? 5 : 3
  if (reading.stroke) return <circle cx={x} cy={reading.y} r={radius} fill={reading.stroke} />
  if (reading.id === 'value') return <circle cx={x} cy={reading.y} r={radius} fill='hsl(var(--focus))' />
  if (reading.id === 'previous') {
    return (
      <circle
        cx={x}
        cy={reading.y}
        r={radius}
        fill={hot ? 'hsl(var(--foreground))' : 'none'}
        stroke='hsl(var(--foreground))'
        strokeOpacity='0.7'
        strokeWidth='1.5'
      />
    )
  }
  return <circle cx={x} cy={reading.y} r={radius} fill='hsl(var(--foreground))' fillOpacity={reading.opacity || '0.7'} />
}

/** The main value, the earlier period, and any extra line at one date. */
function chartReadings (point, index, { compare, lines, label, yAt }) {
  const readings = []
  if (point.value !== null && point.value !== undefined) {
    readings.push({ id: 'value', label: label || '', value: point.value, when: point.periodStart })
  }
  if (compare && point.previous !== null && point.previous !== undefined) {
    readings.push({ id: 'previous', label: '', value: point.previous, when: point.previousStart })
  }
  lines.forEach((line, lineIndex) => {
    const value = line.points[index] && line.points[index].value
    if (value === null || value === undefined) return
    readings.push({
      id: `line-${lineIndex}`,
      label: line.label,
      value,
      when: point.periodStart,
      opacity: line.opacity,
      stroke: line.stroke
    })
  })
  readings.forEach(item => { item.y = yAt(item.value) })
  return readings
}

/** The hovered reading, every other series on that same dot, and the comparison period. */
function hoveredReadings (readings, series, showAll) {
  const anchor = readings.find(item => item.id === series)
  if (!anchor) return []
  if (showAll) {
    const sameDay = readings.filter(item => item.when === anchor.when)
    return [
      ...sameDay.filter(item => item.id === series),
      ...sameDay.filter(item => item.id !== series)
    ]
  }
  const ids = new Set(readings.filter(item => Number(item.value) === Number(anchor.value)).map(item => item.id))
  if (series === 'value' || series === 'previous') {
    readings.forEach(item => {
      if (item.id === 'value' || item.id === 'previous') ids.add(item.id)
    })
  }
  const picked = readings.filter(item => ids.has(item.id))
  return [
    ...picked.filter(item => item.when === anchor.when && item.id === series),
    ...picked.filter(item => item.when === anchor.when && item.id !== series),
    ...picked.filter(item => item.when !== anchor.when)
  ]
}

/** Groups tooltip rows that share a period. */
function readingGroups (items) {
  const groups = []
  items.forEach(item => {
    const last = groups[groups.length - 1]
    if (last && last.when === item.when) last.items.push(item)
    else groups.push({ when: item.when, items: [item] })
  })
  return groups
}

/** A line with a count scale and a date scale. Missing periods leave a gap. Extra lines share the same dates. */
function LineChart ({ points, period, compare, lines = [], unit, label, showAll = false }) {
  const { t } = useTranslation()
  const [hover, setHover] = useState(null)
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
  lines.forEach(line => {
    line.points.forEach(point => {
      if (point.value !== null && point.value !== undefined) values.push(point.value)
    })
  })
  const max = unit === 'percent' ? 1 : Math.max(...values, 1)
  const step = points.length === 1 ? 0 : plotWidth / (points.length - 1)
  const xAt = index => pad.left + index * step
  const yAt = value => pad.top + plotHeight - (value / max) * plotHeight
  const path = linePath(points, 'value', xAt, yAt)
  const previousPath = compare ? linePath(points, 'previous', xAt, yAt) : ''
  const dots = points.map((point, index) => ({
    x: xAt(index),
    key: point.periodStart,
    readings: chartReadings(point, index, { compare, lines, label, yAt })
  })).filter(dot => dot.readings.length)
  const active = hover && dots.find(dot => dot.key === hover.key)
  const shown = active ? hoveredReadings(active.readings, hover.series, showAll) : []
  const anchor = hover ? shown.find(item => item.id === hover.series) : null
  const activeY = anchor ? anchor.y : null
  let hoverShift = 'translate(-50%, calc(-100% - 8px))'
  if (active && active.x > width * 0.75) hoverShift = 'translate(-100%, calc(-100% - 8px))'
  else if (active && active.x < width * 0.25) hoverShift = 'translate(0, calc(-100% - 8px))'

  return (
    <div className='relative'>
      <svg viewBox={`0 0 ${width} ${height}`} className='w-full h-auto text-foreground/50' role='img'>
        {yTicks(max, unit).map(tick => (
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
              {formatAxis(tick, unit)}
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
        {lines.map(line => (
          <path
            key={line.label}
            d={linePath(line.points, 'value', xAt, yAt)}
            fill='none'
            stroke={line.stroke || 'hsl(var(--foreground))'}
            strokeOpacity={line.stroke ? '1' : line.opacity}
            strokeWidth={line.stroke ? '2' : '1.5'}
            strokeDasharray={line.dash === '0' ? undefined : line.dash}
          />
        ))}
        {dots.map(dot => {
          const paint = [...dot.readings].reverse()
          const hotIds = hover?.key === dot.key ? shown.map(item => item.id) : []
          return (
            <g key={dot.key}>
              {paint.map(reading => (
                <ChartDot key={reading.id} reading={reading} x={dot.x} hot={hotIds.includes(reading.id)} />
              ))}
              {paint.map(reading => (
                <circle
                  key={`${reading.id}-hit`}
                  cx={dot.x}
                  cy={reading.y}
                  r='14'
                  fill='transparent'
                  className='cursor-pointer'
                  onMouseEnter={() => setHover({ key: dot.key, series: reading.id })}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </g>
          )
        })}
      </svg>
      {shown.length > 0 && (
        <div
          className='pointer-events-none absolute z-10 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md'
          style={{
            left: `${(active.x / width) * 100}%`,
            top: `${(activeY / height) * 100}%`,
            transform: hoverShift
          }}
        >
          {readingGroups(shown).map(group => (
            <div key={group.when} className='mt-1 first:mt-0'>
              <div>{periodRange(group.when, period)}</div>
              {group.items.map(item => (
                <div key={item.id}>
                  {item.label && <div className='font-normal opacity-80'>{item.label}</div>}
                  <div className='font-semibold'>{formatValue(item.value, unit, t)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Shows a rate as a percent, a duration as hours, and a count with thousands separators. */
function formatValue (value, unit, t) {
  if (value === null || value === undefined) return '—'
  if (unit === 'hours') return t('{{count}} hours', { count: Math.round(value).toLocaleString() })
  if (unit === 'percent') return `${Math.round(value * 100)}%`
  return Math.round(value).toLocaleString()
}

/** Scrollable list of the people counted in a metric, anchored under its Who link. */
function PeoplePopover ({ people }) {
  const { t } = useTranslation()
  return (
    <div
      data-testid='who-people'
      className='absolute left-0 top-full z-20 mt-1 max-h-60 w-64 overflow-y-auto rounded-md border border-foreground/10 bg-card p-2 shadow-md'
    >
      {people.loading && <Loading type='inline' />}
      {!people.loading && people.rows.length === 0 && <p className='text-sm text-foreground/60'>{t('No people to show')}</p>}
      <ul>
        {people.rows.map(person => (
          <li key={person.id} className='flex items-center gap-2 py-1.5 text-sm'>
            <span className='text-foreground'>{person.name}</span>
            <span className='ml-auto text-foreground/60'>{person.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The size of a change. Rates are percentage points. */
function formatDelta (delta, unit, t) {
  const magnitude = Math.abs(delta)
  if (unit === 'percent') return t('{{value}} pts', { value: (magnitude * 100).toFixed(1) })
  if (unit === 'hours') return t('{{count}} hours', { count: Math.round(magnitude).toLocaleString() })
  return Math.round(magnitude).toLocaleString()
}

/** Green when the number moved the way this metric wants. A fall can be the good direction. */
function ChangeNote ({ value, previous, unit, good, comparable, compare }) {
  const { t } = useTranslation()
  if (!compare) return null
  if (comparable === false) return <div className='text-xs text-foreground/50'>{t('Earlier period: not available')}</div>
  const change = changeTone(value, previous)
  if (!change) return null
  let tone = 'text-red-700 dark:text-red-400'
  if (change.direction === 'flat' || good === 'neutral') tone = 'text-foreground/60'
  else if (change.direction === good) tone = 'text-green-700 dark:text-green-400'
  let word = t('worse')
  if (change.direction === 'flat') word = t('no change')
  else if (change.direction === good) word = t('better')
  else if (good === 'neutral') word = ''
  const arrow = change.direction === 'up' ? '▲' : change.direction === 'down' ? '▼' : '■'
  return (
    <div className={`text-xs font-medium ${tone}`}>
      {arrow} {change.direction === 'flat' ? word : formatDelta(change.delta, unit, t)} {change.direction === 'flat' ? '' : word}
    </div>
  )
}

/** One metric: its latest value, the change from the earlier period, and the series behind it. */
function MetricCard ({ label, explainer, value, when, points, period, compare, unit, good, comparable, lines, breakdown, onWho, whoLabel, people, anchorRef }) {
  const { t } = useTranslation()
  const [openInfo, setOpenInfo] = useState(false)
  const open = Boolean(people)
  const previous = points && points.length ? latestValue(points)?.previous : null
  return (
    <div className={open ? 'relative z-20 rounded-lg border border-foreground/10 bg-card p-3' : 'relative rounded-lg border border-foreground/10 bg-card p-3'}>
      <div className='flex items-start gap-2'>
        <div className='text-sm text-foreground/60'>{label}</div>
        {explainer && (
          <button
            type='button'
            aria-expanded={openInfo}
            aria-label={t('About this metric')}
            className='ml-auto h-5 w-5 shrink-0 rounded-full border border-foreground/20 text-[11px] text-foreground/60'
            onClick={() => setOpenInfo(current => !current)}
          >
            i
          </button>
        )}
      </div>
      {openInfo && explainer && <div className='text-xs text-foreground/60 mt-1 mb-1'>{explainer}</div>}
      {value !== null && value !== undefined && (
        <div className='text-2xl font-semibold text-foreground'>{formatValue(value, unit, t)}</div>
      )}
      <ChangeNote value={value} previous={previous} unit={unit} good={good} comparable={comparable} compare={compare} />
      {onWho && (
        <div ref={anchorRef} className='relative mb-1'>
          <button type='button' aria-expanded={open} className='text-xs text-foreground/70 underline' onClick={onWho}>{whoLabel}</button>
          {open && <PeoplePopover people={people} />}
        </div>
      )}
      {when && <div className='text-xs text-foreground/60 mb-1'>{when}</div>}
      {breakdown}
      {points && <LineChart points={points} period={period} compare={compare} lines={lines} unit={unit} label={lines.length ? label : ''} />}
      {lines && lines.length > 0 && (
        <div className='mt-1 text-[11px] text-foreground/50'>{t('Also shown')}: {lines.map(line => line.label).join(', ')}</div>
      )}
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
  const [byPeriod, setByPeriod] = useState(null)
  const [error, setError] = useState(null)
  const [people, setPeople] = useState(null)
  const peopleRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setByPeriod(null)
    setError(null)
    setPeople(null)
    Promise.all(['day', 'week', 'month'].map(period => {
      const { from, to } = queryWindow(period, rangeId)
      const metrics = metricsForPeriod(period, { signupMetric })
      const request = groupId
        ? queryHyloAPI({ query: GROUP_QUERY, variables: { id: groupId, metrics, period, from, to } })
        : queryHyloAPI({ query: PLATFORM_QUERY, variables: { metrics, period, from, to } })
      return request.then(result => {
        const next = groupId ? result?.data?.group?.metrics : result?.data?.platformMetrics
        if (!next) throw new Error(result?.errors?.[0]?.message || 'Not enough activity in this period yet')
        return [period, next]
      })
    })).then(entries => {
      if (!cancelled) setByPeriod(Object.fromEntries(entries))
    }).catch(err => {
      if (!cancelled) {
        setError(err.message)
        setByPeriod({ day: [], week: [], month: [] })
      }
    })
    return () => { cancelled = true }
  }, [groupId, rangeId, signupMetric])

  const rawSeries = (metric, period, dimension = '') => {
    const matches = (byPeriod?.[period] || []).filter(item => item.metric === metric && (item.dimension || '') === dimension)
    return matches[0] || null
  }

  const shownFor = (metric, period) => {
    const { displayFrom } = queryWindow(period, rangeId)
    if (metric === 'contributor_wow_retention') {
      return chartPoints(
        retentionRates(rawSeries('contributor_cohort', 'week')?.points, rawSeries('contributor_retained', 'week')?.points),
        displayFrom,
        'week',
        rangeId
      )
    }
    return chartPoints(rawSeries(metric, period, '')?.points || [], displayFrom, period, rangeId)
  }

  /** Loads the people counted in the latest point of a person metric, or closes that list. */
  const handleWho = (metric, period, periodStart) => {
    const key = `${metric}:${period}`
    if (people?.key === key) {
      setPeople(null)
      return
    }
    setPeople({ key, loading: true, rows: [] })
    queryHyloAPI({
      query: PEOPLE_QUERY,
      variables: { metric, groupId: groupId || null, period, periodStart }
    }).then(result => {
      setPeople(current => current?.key === key
        ? { key, loading: false, rows: result?.data?.metricPeople?.people || [] }
        : current)
    }).catch(() => {
      setPeople(current => current?.key === key ? { key, loading: false, rows: [] } : current)
    })
  }

  const labelFor = spec => t(spec.label || HEALTH_LABELS[spec.id] || LABELS[spec.id] || spec.id)
  const explainerFor = spec => {
    const text = EXPLAINERS[spec.id]
    return text ? t(text) : null
  }

  /** The lines, table, or headline points for one catalog metric. */
  const viewFor = spec => {
    const points = shownFor(spec.id, spec.period)
    const point = latestValue(points)
    const { displayFrom } = queryWindow(spec.period, rangeId)
    const lines = (spec.lines || []).map((line, index) => {
      const styles = [{ opacity: '0.4', dash: '2 2' }, { opacity: '0.65', dash: '0' }, { opacity: '0.9', dash: '6 3' }]
      const seriesPoints = chartPoints(rawSeries(spec.id, spec.period, line.dimension)?.points || [], displayFrom, spec.period, rangeId)
      const byDay = new Map(seriesPoints.map(item => [item.periodStart, item.value]))
      return {
        label: t(line.label),
        ...styles[index] || styles[0],
        points: points.map(item => ({ ...item, value: byDay.has(item.periodStart) ? byDay.get(item.periodStart) : null }))
      }
    })
    let breakdown = null
    if (spec.view === 'latest') {
      const rows = spec.rows.map(row => ({
        label: row.label,
        value: latestValue(chartPoints(rawSeries(spec.id, spec.period, row.dimension)?.points || [], displayFrom, spec.period, rangeId))?.value
      })).filter(row => row.value !== null && row.value !== undefined)
      if (rows.length) {
        breakdown = (
          <table className='w-full text-xs mb-2'>
            <tbody>
              {rows.map(row => (
                <tr key={row.label}>
                  <td className='py-0.5 pr-2 text-foreground/70'>{t(row.label)}</td>
                  <td className='py-0.5 text-right text-foreground'>{formatValue(row.value, spec.unit || 'count', t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    }
    if (spec.view === 'months') {
      const series = spec.rows.map(row => ({
        label: row.label,
        points: chartPoints(rawSeries(spec.id, spec.period, row.dimension)?.points || [], displayFrom, spec.period, rangeId)
      }))
      const dates = (series[0]?.points || []).map(item => item.periodStart).slice(-6)
      if (dates.length) {
        breakdown = (
          <table className='w-full text-xs mb-2'>
            <thead>
              <tr className='text-foreground/50'>
                <th className='py-0.5 text-left font-normal' />
                {series.map(row => <th key={row.label} className='py-0.5 text-right font-normal'>{t(row.label)}</th>)}
              </tr>
            </thead>
            <tbody>
              {dates.map(date => (
                <tr key={date}>
                  <td className='py-0.5 text-foreground/70'>{formatWhen(date, 'month')}</td>
                  {series.map(row => {
                    const value = row.points.find(item => item.periodStart === date)?.value
                    return <td key={row.label} className='py-0.5 text-right text-foreground'>{formatValue(value, spec.unit || 'count', t)}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    }
    const hasBreakdown = Boolean(breakdown)
    return { points, point, lines, breakdown, hasBreakdown }
  }

  useEffect(() => {
    if (!people) return undefined
    const handleMouseDown = (event) => {
      if (peopleRef.current?.contains(event.target)) return
      setPeople(null)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setPeople(null)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [people])

  return (
    <div className='w-full p-4'>
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
        {t('The range sets how much history the charts show. Daily numbers compare with the previous week or month. Weekly and monthly numbers compare with a year earlier.')}
      </p>
      {error && <p className='text-sm text-accent mb-3'>{error}</p>}
      {!byPeriod && <Loading />}
      {byPeriod && (
        <>
          <NorthStar
            t={t}
            compare={compare}
            points={shownFor('connected_members', 'week')}
            extra={shownFor('connected_beyond_reaction', 'week')}
          />
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2'>
            {VITAL.map(spec => {
              const points = shownFor(spec.id, spec.period)
              const point = latestValue(points)
              if (!point || point.value === null) return null
              return (
                <div key={`${spec.id}:${spec.period}`} className='rounded-lg border border-foreground/10 bg-card p-3'>
                  <div className='text-sm text-foreground/60'>{labelFor(spec)}</div>
                  <div className='text-2xl font-semibold text-foreground'>{formatValue(point.value, spec.unit, t)}</div>
                  <ChangeNote value={point.value} previous={point.previous} unit={spec.unit} good={spec.good} comparable={spec.comparable} compare={compare} />
                </div>
              )
            })}
          </div>
          {SECTIONS.map(section => {
            const cards = section.metrics.filter(spec => !spec.signup || signupMetric).map(spec => {
              const view = viewFor(spec)
              if ((!view.point || view.point.value === null) && !view.hasBreakdown) return null
              const when = !view.point
                ? null
                : spec.period === 'week'
                  ? t('Week of {{date}}', { date: formatWhen(view.point.periodStart, 'day') })
                  : formatWhen(view.point.periodStart, spec.period)
              const key = `${spec.id}:${spec.period}`
              return (
                <MetricCard
                  key={key}
                  label={labelFor(spec)}
                  explainer={explainerFor(spec)}
                  value={view.point ? view.point.value : null}
                  when={when}
                  points={spec.view ? null : view.points}
                  period={spec.period}
                  compare={compare}
                  unit={spec.unit}
                  good={spec.good}
                  comparable={spec.comparable}
                  lines={spec.lines ? view.lines : []}
                  breakdown={view.breakdown}
                  whoLabel={t('Who')}
                  people={people?.key === key ? people : null}
                  anchorRef={people?.key === key ? peopleRef : null}
                  onWho={spec.people && view.point ? () => handleWho(spec.id, spec.period, view.point.periodStart) : null}
                />
              )
            }).filter(Boolean)
            if (!cards.length) return null
            return (
              <section key={section.id} className='mt-8'>
                <h2 className='text-lg font-semibold text-foreground'>{t(section.title)}</h2>
                <p className='text-sm text-foreground/60 mb-3'>{t(section.question)}</p>
                {section.id === 'audience' && (
                  <ActivePeople
                    t={t}
                    group={Boolean(groupId)}
                    daily={shownFor('active_users', 'day')}
                    weekly={shownFor('wau', 'day')}
                    monthly={shownFor('mau', 'day')}
                  />
                )}
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>{cards}</div>
              </section>
            )
          })}
          {!groupId && (
            <>
              <section className='mt-8'>
                <h2 className='text-lg font-semibold text-foreground'>{t('What we do not optimize')}</h2>
                <ul className='mt-2 list-disc pl-5 text-sm text-foreground/70 space-y-1'>
                  {AVOID.map(item => <li key={item}>{t(item)}</li>)}
                </ul>
              </section>
              <section className='mt-6 mb-4'>
                <h2 className='text-lg font-semibold text-foreground'>{t('What we cannot measure yet')}</h2>
                <ul className='mt-2 list-disc pl-5 text-sm text-foreground/70 space-y-1'>
                  {GAPS.map(item => <li key={item}>{t(item)}</li>)}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}

/** The stored value of one series on a calendar day. */
function valueOn (points, day) {
  const match = (points || []).find(item => item.periodStart === day)
  return match ? match.value : null
}

/** Daily, weekly and monthly people who opened Hylo. Looking counts, with or without a post. */
export function ActivePeople ({ t, group = false, daily = [], weekly = [], monthly = [] }) {
  const hasValue = [daily, weekly, monthly].some(series => series.some(point => point.value !== null && point.value !== undefined))
  if (!hasValue) return null
  const base = [daily, weekly, monthly].reduce((best, series) => series.length > best.length ? series : best, [])
  const points = base.map(item => ({
    ...item,
    value: valueOn(daily, item.periodStart)
  }))
  const lines = [
    {
      label: t('Weekly active people'),
      stroke: 'hsl(var(--selected))',
      dash: '0',
      points: base.map(item => ({ ...item, value: valueOn(weekly, item.periodStart) }))
    },
    {
      label: t('Monthly active people'),
      stroke: 'hsl(var(--foreground))',
      dash: '0',
      points: base.map(item => ({ ...item, value: valueOn(monthly, item.periodStart) }))
    }
  ]
  const latest = [
    { label: t('Daily active people'), color: 'hsl(var(--focus))', value: latestValue(daily)?.value },
    { label: t('Weekly active people'), color: 'hsl(var(--selected))', value: latestValue(weekly)?.value },
    { label: t('Monthly active people'), color: 'hsl(var(--foreground))', value: latestValue(monthly)?.value }
  ]
  const explainer = group
    ? t('Anyone who opened this group, even just to look. Daily is that day. Weekly is the last 7 days. Monthly is the last 30 days.')
    : t('Anyone who opened Hylo, even just to look. Daily is that day. Weekly is the last 7 days. Monthly is the last 30 days.')
  return (
    <section data-testid='active-audience' className='mb-3 rounded-lg border border-foreground/10 bg-card p-4'>
      <h3 className='text-base font-semibold text-foreground'>{t('Daily, weekly and monthly active people')}</h3>
      <p className='text-sm text-foreground/70 mb-2'>{explainer}</p>
      <div className='mb-2 flex flex-wrap gap-x-4 gap-y-1'>
        {latest.map(item => (
          <div key={item.label} className='text-sm text-foreground'>
            <span className='mr-1 inline-block h-2 w-2 rounded-full' style={{ background: item.color }} />
            {item.label}
            {item.value !== null && item.value !== undefined && (
              <span className='ml-1 font-semibold'>{formatValue(item.value, 'count', t)}</span>
            )}
          </div>
        ))}
      </div>
      <LineChart points={points} period='day' lines={lines} label={t('Daily active people')} showAll />
    </section>
  )
}

/** The headline metric: people on either side of a real interaction. */
function NorthStar ({ t, compare, points, extra }) {
  const point = latestValue(points)
  if (!point || point.value === null) return null
  const byDay = new Map((extra || []).map(item => [item.periodStart, item.value]))
  const lines = [{
    label: t('Connected by more than a reaction'),
    opacity: '0.7',
    dash: '0',
    points: points.map(item => ({ ...item, value: byDay.has(item.periodStart) ? byDay.get(item.periodStart) : null }))
  }]
  return (
    <section className='mb-4 rounded-lg border border-foreground/10 bg-card p-4'>
      <div className='text-xs tracking-wide text-foreground/50'>{t('North star')}</div>
      <h2 className='text-lg font-semibold text-foreground'>{t('Weekly connected members')}</h2>
      <div className='text-3xl font-semibold text-foreground'>{formatValue(point.value, 'count', t)}</div>
      <ChangeNote value={point.value} previous={point.previous} good='up' compare={compare} />
      <div className='text-xs text-foreground/60 mb-2'>{t('Week of {{date}}', { date: formatWhen(point.periodStart, 'day') })}</div>
      <p className='text-sm text-foreground/70 mb-2'>{t('People on either side of an interaction between two people in a week: a comment, reaction, RSVP, vote, or project join. Both people count. Direct messages and the Axolotl bot are left out.')}</p>
      <p className='text-sm text-foreground/70 mb-3'>{t('This is the moment Hylo creates value: someone showed up and someone else answered. Notification blasts and empty signups do not raise it.')}</p>
      <LineChart points={points} period='week' compare={compare} lines={lines} label={t('Weekly connected members')} />
      <div className='mt-1 text-[11px] text-foreground/50'>{t('The second line is people connected by more than a reaction.')}</div>
    </section>
  )
}
