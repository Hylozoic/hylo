import React, { useEffect, useMemo, useState } from 'react'
import { isNumber, isWindowEnd, useFormat } from './format'
import { alignSeries, lineKey } from './compare'
import ComparisonTable from './ComparisonTable'

const PRIMARY_COLOR = 'hsl(var(--focus))'
const SECONDARY_COLOR = 'hsl(var(--foreground))'
const SECONDARY_STYLES = [
  { opacity: 0.5, dash: undefined },
  { opacity: 0.5, dash: '1 3' },
  { opacity: 0.5, dash: '6 3' }
]
const PARTIAL_DASH = '4 3'
// Longer dashes at reduced opacity, so an earlier period never reads as the in-progress segment or a secondary line
const COMPARISON_STYLE = { opacity: 0.45, dash: '9 5', width: 1.75 }
const SPARK_COMPARISON_STYLE = { opacity: 0.35, dash: '3 2', width: 1 }
const MAX_PLOTTED_LINES = 4
// A same-unit line this many times larger than the primary would flatten it, so it is listed instead
const MAX_SECONDARY_SCALE = 3
const MIN_MEASURED_WIDTH = 240
// Below this the '(partial)' axis suffix would run into the start label; the legend still marks the period
const MIN_WIDTH_FOR_PARTIAL_LABEL = 360

// Tracks an element's rendered width so the chart's coordinate system matches real pixels and
// axis text stays the same size on every screen.
function useMeasuredWidth (node) {
  const [width, setWidth] = useState(null)
  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const next = Math.round(entries[0]?.contentRect?.width || 0)
      if (next > 0) setWidth(next)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return width
}

const SIZES = {
  card: { width: 520, height: 180, margin: { top: 10, right: 12, bottom: 24, left: 52 }, font: 11 },
  hero: { width: 720, height: 240, margin: { top: 12, right: 16, bottom: 26, left: 56 }, font: 12 },
  spark: { width: 120, height: 32, margin: { top: 3, right: 3, bottom: 3, left: 3 }, font: 0 }
}

// Splits a series into drawable path strings, breaking on nulls. The final segment is drawn
// separately (dashed) when the last bucket is still in progress.
function buildPaths (values, xAt, yAt, partialLast) {
  const n = values.length
  const solidEnd = partialLast ? n - 2 : n - 1
  let solid = ''
  let pen = false
  for (let i = 0; i <= solidEnd; i++) {
    const v = values[i]
    if (!isNumber(v)) {
      pen = false
      continue
    }
    solid += `${pen ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`
    pen = true
  }
  let partial = null
  if (partialLast && n >= 2 && isNumber(values[n - 1]) && isNumber(values[n - 2])) {
    partial = `M${xAt(n - 2).toFixed(1)},${yAt(values[n - 2]).toFixed(1)}L${xAt(n - 1).toFixed(1)},${yAt(values[n - 1]).toFixed(1)}`
  }
  return { solid, partial }
}

function maxOf (line) {
  return Math.max(...(line.values || []).filter(isNumber))
}

function splitLines (lines = [], unit) {
  const primary = lines.find(l => l.primary) || lines[0]
  if (!primary) return { primary: null, secondaries: [], offAxis: [] }
  const primaryUnit = primary.unit || unit
  const primaryMax = maxOf(primary)
  const others = lines.filter(l => l !== primary)
  const sameUnit = others.filter(l => (l.unit || unit) === primaryUnit && !(primaryMax > 0 && maxOf(l) > primaryMax * MAX_SECONDARY_SCALE))
  const plottedSecondaries = sameUnit.slice(0, MAX_PLOTTED_LINES - 1)
  const offAxis = others.filter(l => !plottedSecondaries.includes(l))
  return { primary, primaryUnit, secondaries: plottedSecondaries, offAxis }
}

function lastCompleteIndex (values, partialLast) {
  const end = partialLast ? values.length - 2 : values.length - 1
  for (let i = end; i >= 0; i--) {
    if (isNumber(values[i])) return i
  }
  return -1
}

function lastNumberIndex (values) {
  for (let i = values.length - 1; i >= 0; i--) {
    if (isNumber(values[i])) return i
  }
  return -1
}

// Points with no numeric neighbour draw no path segment, so they are marked with a dot instead
function isolatedIndexes (values) {
  return values.reduce((acc, v, i) => (isNumber(v) && !isNumber(values[i - 1]) && !isNumber(values[i + 1]) ? [...acc, i] : acc), [])
}

/**
 * Line chart for a normalized `series` metric. The primary line is emphasized, secondary lines of the
 * same unit are drawn lighter, and lines in other units are listed below with their latest value.
 * With a `comparison` ({ period, label, metric }), the primary line's values from the earlier panel are
 * drawn faintly dashed, and hover titles and the off-axis list include the earlier values.
 */
export default function SeriesChart ({ data, unit, label, variant = 'card', comparison }) {
  const fmt = useFormat()
  const { t } = fmt
  const baseSize = SIZES[variant] || SIZES.card
  const [node, setNode] = useState(null)
  const measured = useMeasuredWidth(variant === 'spark' ? null : node)
  const size = useMemo(() => measured
    ? { ...baseSize, width: Math.max(MIN_MEASURED_WIDTH, measured) }
    : baseSize, [baseSize, measured])
  const x = data?.x || []
  const partialLast = !!data?.partialLast
  const windowEnd = isWindowEnd(data)
  const { primary, primaryUnit, secondaries = [], offAxis = [] } = useMemo(() => splitLines(data?.lines, unit), [data, unit])
  const comparisonData = comparison?.metric?.data
  const comparisonPeriod = comparison?.period
  const aligned = useMemo(
    () => (comparisonData ? alignSeries(data, comparisonData, comparisonPeriod) : null),
    [data, comparisonData, comparisonPeriod]
  )
  const comparisonOf = line => (aligned && line ? aligned.values[lineKey(line)] || null : null)
  const primaryComparison = comparisonOf(primary)

  const geometry = useMemo(() => {
    if (!primary || x.length === 0) return null
    const { width, height, margin } = size
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom
    const current = [primary, ...secondaries].flatMap(l => (l.values || []).filter(isNumber))
    if (current.length === 0) return null
    const all = primaryComparison ? [...current, ...primaryComparison.filter(isNumber)] : current
    const min = Math.min(0, ...all)
    let max = Math.max(...all)
    if (max === min) max = min + (max === 0 ? 1 : Math.abs(max))
    const top = max + (max - min) * 0.08
    const n = x.length
    const xAt = i => margin.left + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1))
    const yAt = v => margin.top + innerH - ((v - min) / (top - min)) * innerH
    return { width, height, margin, innerW, innerH, min, max, xAt, yAt, n }
  }, [primary, secondaries, primaryComparison, x, size])

  if (!primary || !geometry) {
    if (variant === 'spark') return null
    return <p className='text-sm text-foreground/60'>{t('No data for this period.')}</p>
  }

  const { width, height, margin, max, xAt, yAt, n } = geometry
  const values = primary.values || []
  const firstIdx = values.findIndex(isNumber)
  const lastIdx = lastCompleteIndex(values, partialLast)
  const partialValue = partialLast && isNumber(values[n - 1]) ? values[n - 1] : null

  const weekly = !windowEnd && (data?.granularity || 'week') === 'week'
  const pointLabel = i => (weekly
    ? t('Week of {{date}}', { date: fmt.point(x[i], data) })
    : fmt.point(x[i], data, { withWindow: true }))
  const summaryParams = firstIdx >= 0 && lastIdx >= 0
    ? {
        label: label || primary.label,
        first: fmt.value(values[firstIdx], primaryUnit),
        firstDate: pointLabel(firstIdx),
        last: fmt.value(values[lastIdx], primaryUnit),
        lastDate: pointLabel(lastIdx)
      }
    : null
  let summary = label || primary.label
  if (summaryParams && (windowEnd || weekly)) summary = t('{{label}}: {{first}} ({{firstDate}}), {{last}} ({{lastDate}}).', summaryParams)
  else if (summaryParams) summary = t('{{label}}: {{first}} in {{firstDate}}, {{last}} in {{lastDate}}.', summaryParams)
  const secondaryValues = secondaries.map(line => {
    const i = lastCompleteIndex(line.values || [], partialLast)
    return i >= 0 ? t('{{line}}: {{value}}', { line: line.label, value: fmt.value(line.values[i], line.unit || unit) }) : null
  }).filter(Boolean)
  const secondarySentence = secondaryValues.length > 0 ? `${secondaryValues.join('; ')}.` : null

  const isSpark = variant === 'spark'
  const hasComparisonLine = !!primaryComparison?.some(isNumber)
  let comparisonSentence = null
  if (comparison && !isSpark) {
    const idx = hasComparisonLine ? lastNumberIndex(primaryComparison) : -1
    comparisonSentence = idx >= 0
      ? t('{{line}}, {{period}}: {{value}} ({{date}}).', {
        line: primary.label,
        period: comparison.label,
        value: fmt.value(primaryComparison[idx], primaryUnit),
        date: fmt.point(aligned.x[idx], comparisonData, { withWindow: true })
      })
      : t('{{line}}, {{period}}: not available.', { line: primary.label, period: comparison.label })
  }
  const ariaLabel = [summary, secondarySentence, partialLast ? t('The last period is still in progress.') : null, comparisonSentence].filter(Boolean).join(' ')

  const primaryPaths = buildPaths(values, xAt, yAt, partialLast)
  const baseY = yAt(0)
  const comparisonStyle = isSpark ? SPARK_COMPARISON_STYLE : COMPARISON_STYLE
  const comparisonPath = hasComparisonLine ? buildPaths(primaryComparison, xAt, yAt, false).solid : ''
  const earlierText = (line, i) => {
    const earlier = comparison ? comparisonOf(line)?.[i] : null
    return isNumber(earlier) ? t('{{line}}, {{period}}: {{value}}', { line: line.label, period: comparison.label, value: fmt.value(earlier, line.unit || unit) }) : null
  }

  const svg = (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width='100%'
      className='block h-auto overflow-visible'
      role={isSpark ? undefined : 'img'}
      aria-hidden={isSpark ? 'true' : undefined}
      aria-label={isSpark ? undefined : ariaLabel}
      preserveAspectRatio='xMidYMid meet'
    >
      {!isSpark && (
        <g fontSize={size.font} fill='currentColor' className='text-foreground/60'>
          <line x1={margin.left} x2={width - margin.right} y1={yAt(max)} y2={yAt(max)} stroke='currentColor' strokeOpacity='0.15' strokeDasharray='2 3' />
          <line x1={margin.left} x2={width - margin.right} y1={baseY} y2={baseY} stroke='currentColor' strokeOpacity='0.3' />
          <text x={margin.left - 6} y={yAt(max)} textAnchor='end' dominantBaseline='middle'>{fmt.value(max, primaryUnit)}</text>
          <text x={margin.left - 6} y={baseY} textAnchor='end' dominantBaseline='middle'>{fmt.value(0, primaryUnit)}</text>
          <text x={xAt(0)} y={height - 6} textAnchor={n === 1 ? 'middle' : 'start'} data-testid='x-axis-start'>{fmt.point(x[0], data)}</text>
          {n > 1 && (
            <text x={xAt(n - 1)} y={height - 6} textAnchor='end' data-testid='x-axis-end'>
              {fmt.point(x[n - 1], data)}{partialLast && width >= MIN_WIDTH_FOR_PARTIAL_LABEL ? ` (${t('partial')})` : ''}
            </text>
          )}
        </g>
      )}

      {hasComparisonLine && (
        <g stroke={PRIMARY_COLOR} strokeOpacity={comparisonStyle.opacity} fill='none' strokeWidth={comparisonStyle.width} strokeLinejoin='round'>
          {comparisonPath && <path d={comparisonPath} strokeDasharray={comparisonStyle.dash} data-testid='comparison-line' />}
          {isolatedIndexes(primaryComparison).map(i => (
            <circle key={i} cx={xAt(i)} cy={yAt(primaryComparison[i])} r={isSpark ? 1.5 : 2.5} fill={PRIMARY_COLOR} fillOpacity={comparisonStyle.opacity} stroke='none' data-testid='comparison-point' />
          ))}
        </g>
      )}

      {!isSpark && secondaries.map((line, idx) => {
        const style = SECONDARY_STYLES[idx % SECONDARY_STYLES.length]
        const paths = buildPaths(line.values || [], xAt, yAt, partialLast)
        return (
          <g key={line.key || idx} stroke={SECONDARY_COLOR} strokeOpacity={style.opacity} fill='none' strokeWidth='1.25'>
            <path d={paths.solid} strokeDasharray={style.dash} />
            {paths.partial && <path d={paths.partial} strokeDasharray={PARTIAL_DASH} strokeOpacity={style.opacity * 0.7} />}
          </g>
        )
      })}

      <g stroke={PRIMARY_COLOR} fill='none' strokeWidth={isSpark ? 1.5 : 2} strokeLinejoin='round' strokeLinecap='round'>
        <path d={primaryPaths.solid} />
        {primaryPaths.partial && <path d={primaryPaths.partial} strokeDasharray={PARTIAL_DASH} />}
      </g>
      {lastIdx >= 0 && (
        <circle cx={xAt(lastIdx)} cy={yAt(values[lastIdx])} r={isSpark ? 2 : 3} fill={PRIMARY_COLOR} />
      )}
      {partialValue !== null && (
        <circle cx={xAt(n - 1)} cy={yAt(partialValue)} r={isSpark ? 2 : 3} fill='hsl(var(--background))' stroke={PRIMARY_COLOR} strokeWidth='1.5' data-testid='partial-point' />
      )}

      {!isSpark && x.map((bucket, i) => {
        const step = n === 1 ? width : (width - margin.left - margin.right) / (n - 1)
        const parts = [primary, ...secondaries].flatMap(l => [`${l.label}: ${fmt.value(l.values?.[i], l.unit || unit)}`, earlierText(l, i)]).filter(Boolean)
        const heading = `${fmt.point(bucket, data, { withWindow: true })}${partialLast && i === n - 1 ? ` (${t('partial')})` : ''}`
        return (
          <rect key={bucket + i} x={xAt(i) - step / 2} y={margin.top} width={step} height={height - margin.top - margin.bottom} fill='transparent'>
            <title>{[heading, ...parts].join('\n')}</title>
          </rect>
        )
      })}
    </svg>
  )

  if (isSpark) return svg

  const showLegend = secondaries.length > 0 || partialLast || hasComparisonLine
  return (
    <div className='space-y-2' ref={setNode}>
      {svg}
      {showLegend && (
        <ul className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/70' aria-label={t('Legend')}>
          <li className='inline-flex items-center gap-1.5'>
            <LegendSwatch color={PRIMARY_COLOR} width={2} />
            {primary.label}
          </li>
          {hasComparisonLine && (
            <li className='inline-flex items-center gap-1.5'>
              <LegendSwatch color={PRIMARY_COLOR} opacity={COMPARISON_STYLE.opacity} dash={COMPARISON_STYLE.dash} width={2} />
              {t('{{line}}, {{period}}', { line: primary.label, period: comparison.label })}
            </li>
          )}
          {secondaries.map((line, idx) => {
            const style = SECONDARY_STYLES[idx % SECONDARY_STYLES.length]
            return (
              <li key={line.key || idx} className='inline-flex items-center gap-1.5'>
                <LegendSwatch color={SECONDARY_COLOR} opacity={style.opacity} dash={style.dash} />
                {line.label}
              </li>
            )
          })}
          {partialLast && (
            <li className='inline-flex items-center gap-1.5'>
              <LegendSwatch color={PRIMARY_COLOR} dash={PARTIAL_DASH} width={2} />
              {t('Period in progress')}
            </li>
          )}
        </ul>
      )}
      {offAxis.length > 0 && comparison && (
        <div className='border-t border-foreground/10 pt-2'>
          <ComparisonTable
            truncateLabels
            periodLabel={comparison.label}
            currentLabel={comparison.currentLabel}
            rows={offAxis.map((line, idx) => {
              const lineValues = line.values || []
              const i = lastCompleteIndex(lineValues, partialLast)
              return {
                key: line.key || idx,
                label: line.label,
                now: i >= 0 ? fmt.value(lineValues[i], line.unit || unit) : fmt.value(null),
                then: fmt.value(i >= 0 ? (comparisonOf(line)?.[i] ?? null) : null, line.unit || unit)
              }
            })}
          />
        </div>
      )}
      {offAxis.length > 0 && !comparison && (
        <dl className='grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs text-foreground/70 border-t border-foreground/10 pt-2'>
          {offAxis.map((line, idx) => {
            const lineValues = line.values || []
            const i = lastCompleteIndex(lineValues, partialLast)
            return (
              <React.Fragment key={line.key || idx}>
                <dt className='truncate' title={line.label}>{line.label}</dt>
                <dd className='text-right tabular-nums text-foreground'>
                  {i >= 0 ? fmt.value(lineValues[i], line.unit || unit) : fmt.value(null)}
                </dd>
              </React.Fragment>
            )
          })}
        </dl>
      )}
    </div>
  )
}

function LegendSwatch ({ color, opacity = 1, dash, width = 1.5 }) {
  return (
    <svg width='18' height='6' aria-hidden='true' className='shrink-0'>
      <line x1='0' x2='18' y1='3' y2='3' stroke={color} strokeOpacity={opacity} strokeDasharray={dash} strokeWidth={width} />
    </svg>
  )
}
