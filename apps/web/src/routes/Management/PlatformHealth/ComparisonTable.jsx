import React from 'react'
import { cn } from 'util/index'
import { useFormat } from './format'

/**
 * Labelled values beside their values from an earlier period. `rows` are { key, label, now, then, thenTitle }
 * with both values already formatted; thenTitle names the earlier row when its label differs.
 * `currentLabel` heads the current column ('Now', or the date being viewed).
 */
export default function ComparisonTable ({ rows, periodLabel, currentLabel, truncateLabels = false }) {
  const { t } = useFormat()
  return (
    <table className='w-full text-xs tabular-nums' data-testid='comparison-table'>
      <thead>
        <tr className='text-2xs text-foreground/70'>
          <td />
          <th scope='col' className='pb-0.5 pl-3 text-right font-medium whitespace-nowrap'>{currentLabel || t('Now')}</th>
          <th scope='col' className='pb-0.5 pl-3 text-right font-medium whitespace-nowrap'>{periodLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.key}>
            <th
              scope='row'
              className={cn('py-0.5 text-left font-normal text-foreground/70', { 'w-full max-w-0 truncate': truncateLabels })}
              title={truncateLabels ? row.label : undefined}
            >
              {row.label}
            </th>
            <td className='py-0.5 pl-3 text-right text-foreground whitespace-nowrap'>{row.now}</td>
            <td className='py-0.5 pl-3 text-right text-foreground/70 whitespace-nowrap' title={row.thenTitle} data-testid='comparison-value'>{row.then}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
