import React, { useState } from 'react'
import { isIsoDate, isMonthlyLabels, useFormat } from './format'

const DEFAULT_VISIBLE_ROWS = 12

// Accent shading reads as "more is better", so it is only used where higher really is better. Columns where
// lower is better (or neither) get a neutral gray so a rising bad value never looks good.
function shadeTone (direction) {
  return direction === 'up' ? 'accent' : 'neutral'
}

function cellShade (value, max, tone) {
  if (typeof value !== 'number' || !Number.isFinite(value) || max <= 0) return undefined
  const strength = Math.max(0, Math.min(1, value / max))
  if (tone === 'accent') return { backgroundColor: `hsl(var(--focus) / ${(0.06 + strength * 0.5).toFixed(2)})` }
  return { backgroundColor: `hsl(var(--foreground) / ${(0.04 + strength * 0.2).toFixed(2)})` }
}

/**
 * Compact cohort table: one row per cohort, value cells shaded by magnitude (percent values on 0..1).
 * Each column's direction comes from data.columnDirections, falling back to the metric's goodDirection.
 */
export default function CohortTable ({ data, unit, label, goodDirection = 'up' }) {
  const fmt = useFormat()
  const { t } = fmt
  const [showAll, setShowAll] = useState(false)
  const columns = data?.columns || []
  const rows = data?.rows || []

  if (rows.length === 0) return <p className='text-sm text-foreground/60'>{t('No data for this period.')}</p>

  const monthly = isMonthlyLabels(rows.map(r => r.label))
  const cellUnit = unit || 'percent'
  const allValues = rows.flatMap(r => (r.values || []).filter(v => typeof v === 'number' && Number.isFinite(v)))
  const shadeMax = cellUnit === 'percent' ? 1 : Math.max(0, ...allValues)
  const hidden = showAll ? 0 : Math.max(0, rows.length - DEFAULT_VISIBLE_ROWS)
  const visibleRows = rows.slice(hidden)
  const columnDirections = Array.isArray(data?.columnDirections) ? data.columnDirections : []
  const directionOf = cIdx => columnDirections[cIdx] || goodDirection || 'up'
  const anyLowerIsBetter = columns.some((col, cIdx) => directionOf(cIdx) === 'down')

  return (
    <div className='space-y-1'>
      <div className='overflow-x-auto'>
        <table className='w-full text-xs tabular-nums border-separate border-spacing-0.5'>
          <caption className='sr-only'>{label}</caption>
          <thead>
            <tr className='text-foreground/60'>
              <th scope='col' className='text-left font-medium pr-2 py-1'>{t('Cohort')}</th>
              <th scope='col' className='text-right font-medium pr-2 py-1'>{t('Size')}</th>
              {columns.map((col, cIdx) => (
                <th
                  key={col}
                  scope='col'
                  className='text-right font-medium px-1 py-1 whitespace-nowrap'
                  title={directionOf(cIdx) === 'down' ? t('Lower is better') : undefined}
                >
                  {col}
                  {directionOf(cIdx) === 'down' && <span aria-hidden='true' className='ml-0.5'>↓</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, idx) => (
              <tr key={`${row.label}-${idx}`}>
                <th scope='row' className='text-left font-normal text-foreground/80 pr-2 whitespace-nowrap'>
                  {isIsoDate(row.label) ? fmt.bucket(row.label, monthly ? 'month' : 'week') : row.label}
                </th>
                <td className='text-right text-foreground/60 pr-2'>{fmt.value(row.size, 'count')}</td>
                {columns.map((col, cIdx) => {
                  const value = row.values?.[cIdx]
                  const tone = shadeTone(directionOf(cIdx))
                  return (
                    <td key={col} className='text-right px-1.5 py-0.5 rounded-sm text-foreground' style={cellShade(value, shadeMax, tone)} data-shade={tone}>
                      {fmt.value(value ?? null, cellUnit)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {anyLowerIsBetter && (
        <p className='text-2xs text-foreground/60' aria-hidden='true'>↓ {t('Lower is better')}</p>
      )}
      {rows.length > DEFAULT_VISIBLE_ROWS && (
        <button
          type='button'
          className='text-xs text-foreground/70 underline hover:text-foreground'
          onClick={() => setShowAll(v => !v)}
          aria-expanded={showAll}
        >
          {showAll
            ? t('Show recent cohorts only')
            : t('Show all {{count}} cohorts', { count: rows.length })}
        </button>
      )}
    </div>
  )
}
