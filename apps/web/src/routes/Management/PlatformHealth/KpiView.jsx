import React from 'react'
import { useFormat } from './format'
import ComparisonTable from './ComparisonTable'
import { shiftPeriodTokens } from './compare'

/**
 * Extra detail for a `kpi` metric: numerator/denominator, breakdown and note. The value itself is the card headline.
 * With a `comparison`, the breakdown also lists the earlier period's values, matched by row label with
 * any quarter in it moved back one period.
 */
export default function KpiView ({ data, unit, comparison }) {
  const fmt = useFormat()
  const { t } = fmt
  if (!data) return null
  const hasFraction = typeof data.numerator === 'number' && typeof data.denominator === 'number'
  const breakdown = Array.isArray(data.breakdown) ? data.breakdown : []

  if (!hasFraction && breakdown.length === 0 && !data.note) return null

  let comparisonRows = null
  if (comparison && breakdown.length > 0) {
    const earlier = Array.isArray(comparison.metric?.data?.breakdown) ? comparison.metric.data.breakdown : []
    const earlierByLabel = new Map(earlier.map(item => [item.label, item]))
    comparisonRows = breakdown.map((item, idx) => {
      const earlierLabel = shiftPeriodTokens(item.label, comparison.period)
      return {
        key: `${item.label}-${idx}`,
        label: item.label,
        now: fmt.value(item.value, item.unit || unit),
        then: fmt.value(earlierByLabel.get(earlierLabel)?.value ?? null, item.unit || unit),
        thenTitle: earlierLabel !== item.label ? earlierLabel : undefined
      }
    })
  }

  return (
    <div className='space-y-2 text-xs'>
      {hasFraction && (
        <p className='text-foreground/70 tabular-nums'>
          {t('{{numerator}} of {{denominator}}', {
            numerator: fmt.value(data.numerator, 'count'),
            denominator: fmt.value(data.denominator, 'count')
          })}
        </p>
      )}
      {comparisonRows && <ComparisonTable rows={comparisonRows} periodLabel={comparison.label} currentLabel={comparison.currentLabel} />}
      {breakdown.length > 0 && !comparisonRows && (
        <dl className='grid grid-cols-[1fr_auto] gap-x-3 gap-y-1'>
          {breakdown.map((item, idx) => (
            <React.Fragment key={`${item.label}-${idx}`}>
              <dt className='text-foreground/70'>{item.label}</dt>
              <dd className='text-right tabular-nums text-foreground'>{fmt.value(item.value, item.unit || unit)}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      {data.note && <p className='text-foreground/60'>{data.note}</p>}
    </div>
  )
}
