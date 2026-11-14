import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { arc as d3Arc, line as d3Line, pie as d3Pie, scaleLinear, scalePoint } from 'd3'

/**
 * The chart block of a designed view: a bar, line or pie chart of a few
 * labelled numbers the steward supplied (see DesignedViewHelpers in
 * @hylo/shared). The block holds only data; this draws it as SVG that React
 * owns, using D3 for scales and shapes, in the group's theme colors.
 *
 * It measures its own width, so it fits a phone or a narrow canvas region,
 * and it always offers the figures as a table for people who cannot see it.
 */

const FALLBACK_WIDTH = 560
const FONT_SIZE = 12
// Rough width of a character at FONT_SIZE, for deciding what fits without measuring text
const CHAR_WIDTH = 6.6

const INK = 'hsl(var(--foreground) / 0.7)'
const GRID = 'hsl(var(--foreground) / 0.12)'
const SERIES = 'hsl(var(--primary))'
const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--selected))',
  'hsl(var(--primary) / 0.5)',
  'hsl(var(--accent) / 0.5)',
  'hsl(var(--selected) / 0.5)',
  'hsl(var(--foreground) / 0.45)',
  'hsl(var(--foreground) / 0.2)'
]

const KIND_NAMES = { bar: 'Bar chart', line: 'Line chart', pie: 'Pie chart' }

const textWidth = text => String(text).length * CHAR_WIDTH

function useWidth (ref) {
  const [width, setWidth] = useState(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const next = element.clientWidth
      if (next > 0) setWidth(next)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return width || FALLBACK_WIDTH
}

// The value axis always includes zero, so bars and lines are not exaggerated
function valueScale (points, range) {
  const values = points.map(point => point.value)
  const low = Math.min(0, ...values)
  const high = Math.max(0, ...values)
  return scaleLinear().domain(low === high ? [0, 1] : [low, high]).nice(4).range(range)
}

function BarChart ({ points, width, format, formatShort, label }) {
  const axisWidth = Math.max(...valueScale(points, [0, 1]).ticks(4).map(tick => textWidth(formatShort(tick)))) + 8
  const plotWidth = width - axisWidth
  const band = plotWidth / points.length
  const longestLabel = Math.max(...points.map(point => textWidth(point.label)))

  // Columns when every label fits under its bar; otherwise one row per bar with its label above,
  // which works at any width
  if (band >= Math.max(28, longestLabel + 6)) {
    const height = 240
    const top = 18
    const bottom = 24
    const y = valueScale(points, [height - bottom, top])
    const barWidth = Math.min(64, band * 0.7)
    const showValues = points.every(point => textWidth(format(point.value)) <= band)
    return (
      <svg width={width} height={height} role='img' aria-label={label} data-testid='designed-chart-svg'>
        <g fontSize={FONT_SIZE} fill={INK}>
          {y.ticks(4).map(tick => (
            <g key={tick}>
              <line x1={axisWidth} x2={width} y1={y(tick)} y2={y(tick)} stroke={GRID} />
              <text x={axisWidth - 6} y={y(tick)} dy='0.32em' textAnchor='end'>{formatShort(tick)}</text>
            </g>
          ))}
          {points.map((point, index) => {
            const center = axisWidth + band * (index + 0.5)
            const barTop = Math.min(y(point.value), y(0))
            return (
              <g key={index} data-testid='designed-chart-bar'>
                <rect x={center - barWidth / 2} y={barTop} width={barWidth} height={Math.max(1, Math.abs(y(point.value) - y(0)))} rx={3} fill={SERIES}>
                  <title>{`${point.label}: ${format(point.value)}`}</title>
                </rect>
                {showValues && <text x={center} y={barTop - 5} textAnchor='middle' fill='hsl(var(--foreground))'>{format(point.value)}</text>}
                <text x={center} y={height - 6} textAnchor='middle'>{point.label}</text>
              </g>
            )
          })}
        </g>
      </svg>
    )
  }

  const rowHeight = 40
  const valueWidth = Math.max(...points.map(point => textWidth(format(point.value)))) + 8
  const x = valueScale(points, [0, Math.max(40, width - valueWidth)])
  return (
    <svg width={width} height={rowHeight * points.length} role='img' aria-label={label} data-testid='designed-chart-svg'>
      <g fontSize={FONT_SIZE} fill={INK}>
        {points.map((point, index) => {
          const top = index * rowHeight
          const start = Math.min(x(point.value), x(0))
          const end = Math.max(x(point.value), x(0))
          return (
            <g key={index} data-testid='designed-chart-bar'>
              <text x={0} y={top + 12}>{point.label}</text>
              <rect x={start} y={top + 17} width={Math.max(1, end - start)} height={16} rx={3} fill={SERIES}>
                <title>{`${point.label}: ${format(point.value)}`}</title>
              </rect>
              <text x={end + 6} y={top + 25} dy='0.32em' fill='hsl(var(--foreground))'>{format(point.value)}</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

function LineChart ({ points, width, formatShort, format, label }) {
  const height = 240
  const top = 16
  const bottom = 24
  const right = 12
  const axisWidth = Math.max(...valueScale(points, [0, 1]).ticks(4).map(tick => textWidth(formatShort(tick)))) + 8
  const keys = points.map((point, index) => index)
  const x = scalePoint().domain(keys).range([axisWidth, width - right]).padding(0.4)
  const y = valueScale(points, [height - bottom, top])
  const path = d3Line().x((point, index) => x(index)).y(point => y(point.value))(points)
  // Label every point when they fit, otherwise every second, third... point
  const longestLabel = Math.max(...points.map(point => textWidth(point.label))) + 8
  const every = Math.max(1, Math.ceil(longestLabel / Math.max(1, x.step())))
  return (
    <svg width={width} height={height} role='img' aria-label={label} data-testid='designed-chart-svg'>
      <g fontSize={FONT_SIZE} fill={INK}>
        {y.ticks(4).map(tick => (
          <g key={tick}>
            <line x1={axisWidth} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={GRID} />
            <text x={axisWidth - 6} y={y(tick)} dy='0.32em' textAnchor='end'>{formatShort(tick)}</text>
          </g>
        ))}
        <path d={path} fill='none' stroke={SERIES} strokeWidth={2.5} strokeLinejoin='round' strokeLinecap='round' />
        {points.map((point, index) => (
          <g key={index} data-testid='designed-chart-point'>
            <circle cx={x(index)} cy={y(point.value)} r={4} fill='hsl(var(--card))' stroke={SERIES} strokeWidth={2}>
              <title>{`${point.label}: ${format(point.value)}`}</title>
            </circle>
            {index % every === 0 && <text x={x(index)} y={height - 6} textAnchor='middle'>{point.label}</text>}
          </g>
        ))}
      </g>
    </svg>
  )
}

function PieChart ({ points, width, format, label }) {
  const size = Math.min(200, width)
  const radius = size / 2
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const slices = d3Pie().sort(null).value(point => point.value)(points)
  const shape = d3Arc().innerRadius(radius * 0.55).outerRadius(radius - 2).padAngle(0.01)
  return (
    <div className='flex flex-wrap items-center gap-4'>
      <svg width={size} height={size} role='img' aria-label={label} data-testid='designed-chart-svg' className='shrink-0'>
        <g transform={`translate(${radius},${radius})`}>
          {slices.map((slice, index) => (
            <path key={index} d={shape(slice)} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke='hsl(var(--card))' strokeWidth={1.5} data-testid='designed-chart-slice'>
              <title>{`${slice.data.label}: ${format(slice.data.value)}`}</title>
            </path>
          ))}
        </g>
      </svg>
      <ul className='m-0 p-0 list-none flex flex-col gap-1 text-sm min-w-0' aria-hidden='true'>
        {points.map((point, index) => (
          <li key={index} className='flex items-center gap-2 min-w-0'>
            <span className='inline-block w-3 h-3 rounded-sm shrink-0' style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
            <span className='truncate'>{point.label}</span>
            <span className='text-foreground/60 shrink-0'>{format(point.value)} · {Math.round((point.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const CHARTS = { bar: BarChart, line: LineChart, pie: PieChart }

export default function DesignedChart ({ block }) {
  const { t, i18n } = useTranslation()
  const frame = useRef(null)
  const width = useWidth(frame)
  const points = useMemo(() => (Array.isArray(block.points) ? block.points : []).filter(point => Number.isFinite(point?.value)), [block.points])

  const { format, formatShort } = useMemo(() => {
    const full = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 })
    const short = new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: 1 })
    return { format: value => full.format(value), formatShort: value => short.format(value) }
  }, [i18n.language])

  if (points.length < 2) return null

  const kindName = t(KIND_NAMES[block.kind] || KIND_NAMES.bar)
  const label = `${kindName}, ${block.title}: ${points.map(point => `${point.label} ${format(point.value)}`).join(', ')}`
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const props = { points, width, format, formatShort, label }
  const Chart = CHARTS[block.kind] || BarChart

  return (
    <figure data-block='chart' className='m-0 min-w-0'>
      <figcaption className='font-bold m-0 mb-2'>{block.title}</figcaption>
      <div ref={frame} className='w-full min-w-0 overflow-hidden'>
        <Chart {...props} />
      </div>
      {block.source && <p className='text-xs text-foreground/60 m-0 mt-1'>{t('Source: {{source}}', { source: block.source })}</p>}
      <details className='mt-1 text-sm'>
        <summary className='cursor-pointer text-foreground/70 text-xs'>{t('Show the figures')}</summary>
        <table className='mt-2 text-sm border-collapse'>
          <thead>
            <tr>
              <th scope='col' className='text-left font-bold pr-4 pb-1'>{t('Item')}</th>
              <th scope='col' className='text-right font-bold pr-4 pb-1'>{t('Value')}</th>
              {block.kind === 'pie' && <th scope='col' className='text-right font-bold pb-1'>{t('Share of total')}</th>}
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={index} className='border-t border-foreground/10'>
                <td className='pr-4 py-0.5'>{point.label}</td>
                <td className='text-right pr-4 py-0.5 tabular-nums'>{format(point.value)}</td>
                {block.kind === 'pie' && <td className='text-right py-0.5 tabular-nums'>{total > 0 ? `${Math.round((point.value / total) * 100)}%` : ''}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
