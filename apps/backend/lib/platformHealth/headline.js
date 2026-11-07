const isNum = v => typeof v === 'number' && Number.isFinite(v)

function fromSeries (data) {
  const line = data.lines.find(l => l.primary) || data.lines[0]
  if (!line) return null
  const values = data.partialLast ? line.values.slice(0, -1) : line.values
  const complete = values.map((v, i) => ({ v, i })).filter(p => isNum(p.v))
  if (!complete.length) return null
  const last = complete[complete.length - 1]
  const prev = complete.length > 1 ? complete[complete.length - 2] : null
  return {
    value: last.v,
    previous: prev ? prev.v : null,
    period: data.x[last.i]
  }
}

function fromCohort (data) {
  const rows = data.rows.filter(r => isNum(r.values[0]))
  if (!rows.length) return null
  const last = rows[rows.length - 1]
  const prev = rows.length > 1 ? rows[rows.length - 2] : null
  return { value: last.values[0], previous: prev ? prev.values[0] : null, period: last.label }
}

// A comparable "latest value vs previous period" summary for any display type.
// Metrics can override this with their own headline(data) when the generic rule
// would pick the wrong number.
export default function computeHeadline (metric, data) {
  if (!data) return null
  if (typeof metric.headline === 'function') return metric.headline(data)
  switch (metric.display) {
    case 'kpi':
      return isNum(data.value) ? { value: data.value, previous: isNum(data.previous) ? data.previous : null } : null
    case 'series':
      return fromSeries(data)
    case 'cohort':
      return fromCohort(data)
    default:
      return null
  }
}
