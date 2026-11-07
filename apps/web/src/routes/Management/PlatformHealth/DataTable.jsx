import React from 'react'
import { useFormat } from './format'

const KNOWN_UNITS = ['count', 'percent', 'hours', 'days', 'ratio']

/**
 * Generic table for `table` metrics. Numeric cells are formatted by their column unit, or by the
 * row's own `unit` value when the table carries units per row (that column is then hidden).
 */
export default function DataTable ({ data, label }) {
  const fmt = useFormat()
  const { t } = fmt
  const allColumns = data?.columns || []
  const rows = data?.rows || []
  const rowUnits = allColumns.some(col => col.key === 'unit') &&
    rows.every(row => row.unit == null || KNOWN_UNITS.includes(row.unit))
  const columns = rowUnits ? allColumns.filter(col => col.key !== 'unit') : allColumns

  if (rows.length === 0 || columns.length === 0) return <p className='text-sm text-foreground/60'>{t('No data for this period.')}</p>

  const numericColumn = columns.map(col => rows.some(row => typeof row[col.key] === 'number'))

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs tabular-nums'>
        <caption className='sr-only'>{label}</caption>
        <thead>
          <tr className='border-b border-foreground/10 text-foreground/60'>
            {columns.map((col, idx) => (
              <th key={col.key} scope='col' className={`py-1 pr-3 font-medium ${numericColumn[idx] ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className='border-b border-foreground/5 align-top'>
              {columns.map((col, idx) => {
                const value = row[col.key]
                const text = typeof value === 'number' ? fmt.value(value, col.unit || (rowUnits && row.unit) || 'count') : fmt.value(value ?? null)
                return idx === 0
                  ? <th key={col.key} scope='row' className='py-1 pr-3 text-left font-normal text-foreground'>{text}</th>
                  : <td key={col.key} className={`py-1 pr-3 text-foreground/90 ${numericColumn[idx] ? 'text-right' : 'text-left'}`}>{text}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
