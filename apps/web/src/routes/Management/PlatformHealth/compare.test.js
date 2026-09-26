import { alignSeries, comparisonAsOf, comparisonMetric, comparisonMetricMap, pairedHeadline, shiftLabel, shiftPeriodTokens } from './compare'

const weekly = { granularity: 'week' }
const monthly = { granularity: 'month' }

describe('comparisonAsOf', () => {
  it('goes back 364 days for a year and 182 for six months', () => {
    expect(comparisonAsOf('2026-09-25', '1y')).toBe('2025-09-26')
    expect(comparisonAsOf('2026-09-25', '6m')).toBe('2026-03-27')
    expect(comparisonAsOf('2026-03-24', '1y')).toBe('2025-03-25')
    expect(comparisonAsOf('2026-03-24', '6m')).toBe('2025-09-23')
  })

  it('keeps the weekday', () => {
    const day = date => new Date(`${date}T00:00:00Z`).getUTCDay()
    expect(day(comparisonAsOf('2026-09-21', '1y'))).toBe(day('2026-09-21'))
    expect(day(comparisonAsOf('2026-09-21', '6m'))).toBe(day('2026-09-21'))
  })

  it('crosses a leap day', () => {
    expect(comparisonAsOf('2024-03-01', '1y')).toBe('2023-03-03')
  })

  it('returns null for an unknown date or period', () => {
    expect(comparisonAsOf('', '1y')).toBeNull()
    expect(comparisonAsOf('2026-09-25', '2y')).toBeNull()
  })
})

describe('shiftLabel', () => {
  it('moves weekly and daily labels by whole weeks', () => {
    expect(shiftLabel('2026-09-21', weekly, '1y')).toBe('2025-09-22')
    expect(shiftLabel('2026-09-21', weekly, '6m')).toBe('2026-03-23')
    expect(shiftLabel('2026-09-21', {}, '1y')).toBe('2025-09-22')
  })

  it('moves monthly labels by calendar months', () => {
    expect(shiftLabel('2026-09-01', monthly, '1y')).toBe('2025-09-01')
    expect(shiftLabel('2026-09-01', monthly, '6m')).toBe('2026-03-01')
    expect(shiftLabel('2026-02-01', monthly, '6m')).toBe('2025-08-01')
  })

  it('clamps the day to the target month', () => {
    expect(shiftLabel('2026-08-31', monthly, '6m')).toBe('2026-02-28')
    expect(shiftLabel('2024-02-29', monthly, '1y')).toBe('2023-02-28')
    expect(shiftLabel('2028-08-31', monthly, '6m')).toBe('2028-02-29')
  })

  it('ignores labels that are not dates', () => {
    expect(shiftLabel('Q3', weekly, '1y')).toBeNull()
  })
})

describe('alignSeries', () => {
  it('matches each point to the same bucket a year earlier, by line key', () => {
    const main = {
      granularity: 'week',
      x: ['2026-09-07', '2026-09-14'],
      lines: [{ key: 'n', label: 'N', values: [10, 11], primary: true }, { key: 'avg', label: 'Average', values: [9, 10] }]
    }
    const comp = {
      granularity: 'week',
      x: ['2025-09-01', '2025-09-08', '2025-09-15'],
      lines: [{ key: 'avg', label: 'Average', values: [1, 2, 3] }, { key: 'n', label: 'N', values: [4, 5, 6], primary: true }]
    }
    expect(alignSeries(main, comp, '1y')).toEqual({
      x: ['2025-09-08', '2025-09-15'],
      values: { n: [5, 6], avg: [2, 3] }
    })
  })

  it('leaves points without an earlier bucket empty and omits lines the earlier panel lacks', () => {
    const main = {
      granularity: 'week',
      x: ['2026-03-30', '2026-04-06', '2026-04-13'],
      lines: [{ key: 'n', values: [1, 2, 3] }, { key: 'new', values: [1, 1, 1] }]
    }
    const comp = { granularity: 'week', x: ['2025-04-07'], lines: [{ key: 'n', values: [7] }] }
    expect(alignSeries(main, comp, '1y')).toEqual({ x: [null, '2025-04-07', null], values: { n: [null, 7, null] } })
  })

  it('matches lines without a key by label', () => {
    const main = { granularity: 'month', x: ['2026-09-01'], lines: [{ label: 'Share', values: [0.5] }] }
    const comp = { granularity: 'month', x: ['2026-03-01'], lines: [{ label: 'Share', values: [0.25] }] }
    expect(alignSeries(main, comp, '6m').values).toEqual({ Share: [0.25] })
  })

  it('leaves in-progress buckets on either side empty', () => {
    const main = {
      granularity: 'week',
      partialLast: true,
      x: ['2026-09-07', '2026-09-14', '2026-09-21'],
      lines: [{ key: 'n', values: [1, 2, 3] }]
    }
    const comp = {
      granularity: 'week',
      partialLast: true,
      x: ['2025-09-08', '2025-09-15', '2025-09-22'],
      lines: [{ key: 'n', values: [4, 5, 6] }]
    }
    expect(alignSeries(main, comp, '1y').values.n).toEqual([4, 5, null])

    const shortComp = { ...comp, x: ['2025-09-08', '2025-09-15'], lines: [{ key: 'n', values: [4, 5] }] }
    expect(alignSeries({ ...main, partialLast: false }, shortComp, '1y').values.n).toEqual([4, null, null])
  })

  it('accepts the nearest earlier point within three days for trailing windows', () => {
    const main = {
      granularity: 'month',
      xMeaning: 'window-end',
      windowDays: 28,
      x: ['2026-08-01', '2026-09-01', '2026-09-25'],
      lines: [{ key: 'v', values: [0.1, 0.2, 0.3] }]
    }
    const comp = {
      granularity: 'month',
      xMeaning: 'window-end',
      windowDays: 28,
      x: ['2025-08-01', '2025-09-01', '2025-09-26'],
      lines: [{ key: 'v', values: [0.4, 0.5, 0.6] }]
    }
    expect(alignSeries(main, comp, '1y')).toEqual({ x: ['2025-08-01', '2025-09-01', '2025-09-26'], values: { v: [0.4, 0.5, 0.6] } })

    const sixMonths = { ...comp, x: ['2026-02-01', '2026-03-01', '2026-03-27'] }
    expect(alignSeries(main, sixMonths, '6m').values.v).toEqual([0.4, 0.5, 0.6])

    const tooFar = { ...comp, x: ['2025-08-01', '2025-09-01', '2025-09-29'] }
    expect(alignSeries(main, tooFar, '1y').values.v).toEqual([0.4, 0.5, null])
  })

  it('does not stretch bucketed series to nearby dates', () => {
    const main = { granularity: 'week', x: ['2026-09-14'], lines: [{ key: 'n', values: [1] }] }
    const comp = { granularity: 'week', x: ['2025-09-16'], lines: [{ key: 'n', values: [2] }] }
    expect(alignSeries(main, comp, '1y').values.n).toEqual([null])
  })

  it('uses each earlier point at most once', () => {
    const main = {
      granularity: 'week',
      xMeaning: 'window-end',
      x: ['2026-09-20', '2026-09-21'],
      lines: [{ key: 'n', values: [1, 2] }]
    }
    const comp = { granularity: 'week', xMeaning: 'window-end', x: ['2025-09-22'], lines: [{ key: 'n', values: [9] }] }
    expect(alignSeries(main, comp, '1y')).toEqual({ x: [null, '2025-09-22'], values: { n: [null, 9] } })

    const duplicated = { granularity: 'week', x: ['2026-09-14', '2026-09-14'], lines: [{ key: 'n', values: [1, 2] }] }
    const once = { granularity: 'week', x: ['2025-09-15'], lines: [{ key: 'n', values: [7] }] }
    expect(alignSeries(duplicated, once, '1y').values.n).toEqual([7, null])
  })

  it('copes with missing data', () => {
    expect(alignSeries({ x: ['2026-09-14'], lines: [{ key: 'n', values: [1] }] }, null, '1y')).toEqual({ x: [null], values: {} })
    expect(alignSeries(null, { x: ['2025-09-15'], lines: [] }, '1y')).toEqual({ x: [], values: {} })
    const comp = { granularity: 'week', x: ['2025-09-15'], lines: [{ key: 'n', values: [null] }] }
    expect(alignSeries({ granularity: 'week', x: ['2026-09-14'], lines: [{ key: 'n', values: [1] }] }, comp, '1y').values.n).toEqual([null])
  })
})

describe('comparison metrics', () => {
  it('indexes the earlier panel by metric id and treats failed metrics as unavailable', () => {
    const metrics = comparisonMetricMap({
      sections: [
        { id: 'a', metrics: [{ id: 'ok', error: null }, { id: 'failed', error: 'timeout' }] },
        { id: 'b', metrics: [{ id: 'other', error: null }] }
      ]
    })
    expect([...metrics.keys()]).toEqual(['ok', 'failed', 'other'])
    expect(comparisonMetric(metrics, { id: 'ok' })).toEqual({ id: 'ok', error: null })
    expect(comparisonMetric(metrics, { id: 'failed' })).toBeNull()
    expect(comparisonMetric(metrics, { id: 'missing' })).toBeNull()
    expect(comparisonMetric(metrics, null)).toBeNull()
    expect(comparisonMetricMap(null).size).toBe(0)
  })

  it('treats metrics the server marks as not comparable over time as unavailable', () => {
    const metrics = comparisonMetricMap({
      sections: [{
        id: 'a',
        metrics: [
          { id: 'point_in_time', error: null, comparable: false, headline: { value: 0 } },
          { id: 'rebuilt', error: null, headline: { value: 0 } },
          { id: 'flagged_then', error: null, comparable: false, headline: { value: 0 } }
        ]
      }]
    })
    expect(comparisonMetric(metrics, { id: 'point_in_time', comparable: false })).toBeNull()
    expect(comparisonMetric(metrics, { id: 'rebuilt' })).not.toBeNull()
    expect(comparisonMetric(metrics, { id: 'flagged_then' })).toBeNull()
  })
})

describe('shiftPeriodTokens', () => {
  it('moves quarters back four for a year and two for six months', () => {
    expect(shiftPeriodTokens('New parent-child links, 2025-Q3', '1y')).toBe('New parent-child links, 2024-Q3')
    expect(shiftPeriodTokens('New peer links, 2026-Q3 (so far)', '6m')).toBe('New peer links, 2026-Q1 (so far)')
    expect(shiftPeriodTokens('New peer links, 2026-Q1', '6m')).toBe('New peer links, 2025-Q3')
    expect(shiftPeriodTokens('New peer links, 2026-Q2', '6m')).toBe('New peer links, 2025-Q4')
  })

  it('leaves other labels alone', () => {
    expect(shiftPeriodTokens('Live groups with a peer link', '1y')).toBe('Live groups with a peer link')
    expect(shiftPeriodTokens('Q3 2025', '1y')).toBe('Q3 2025')
  })
})

describe('pairedHeadline', () => {
  const monthlySeries = (x, values, headlineIdx, extra = {}) => ({
    display: 'series',
    data: { granularity: 'month', x, lines: [{ key: 'n', label: 'N', values, primary: true }], partialLast: true, ...extra },
    headline: { value: values[headlineIdx], previous: values[headlineIdx - 1], period: x[headlineIdx] }
  })

  it('takes the earlier headline when it is for the matching period', () => {
    const main = monthlySeries(['2026-07-01', '2026-08-01', '2026-09-01'], [10, 11, 12], 1)
    const earlier = monthlySeries(['2025-07-01', '2025-08-01', '2025-09-01'], [5, 6, 7], 1)
    expect(pairedHeadline(main, main.headline, earlier, earlier.headline, '1y')).toBe(earlier.headline)
  })

  it('reads the matching month when the earlier panel was a month further on (month-end dates)', () => {
    // Viewed on 2026-08-31: August is in progress, so the headline is July. A year earlier is 2025-09-01,
    // where August 2025 is already complete and is that panel's own headline.
    const main = monthlySeries(['2026-06-01', '2026-07-01', '2026-08-01'], [10, 11, 12], 1)
    const earlier = monthlySeries(['2025-07-01', '2025-08-01', '2025-09-01'], [5, 6, 7], 1)
    expect(pairedHeadline(main, main.headline, earlier, earlier.headline, '1y')).toEqual({ value: 5, period: '2025-07-01' })
  })

  it('uses the same cohort row and column a period earlier when the latest cohorts differ', () => {
    const cohort = (rows, headline) => ({ display: 'cohort', data: { columns: ['Week 1', 'Weeks 7–8'], rows }, headline })
    const main = cohort([
      { label: '2026-06-01 · All signups', values: [0.21, 0.056] },
      { label: '2026-07-01 · All signups', values: [0.18, null] }
    ], { value: 0.056, previous: null, period: '2026-06-01' })
    const earlier = cohort([
      { label: '2025-06-01 · All signups', values: [0.22, 0.058] },
      { label: '2025-07-01 · All signups', values: [0.17, 0.047] }
    ], { value: 0.047, previous: null, period: '2025-07-01' })
    expect(pairedHeadline(main, main.headline, earlier, earlier.headline, '1y')).toEqual({ value: 0.058, period: '2025-06-01' })
  })

  it('gives nothing when the matching value cannot be found', () => {
    // A headline that is not any point of the series (e.g. a rolling rate) can't be read off the earlier one
    const main = monthlySeries(['2026-06-01', '2026-07-01', '2026-08-01'], [10, 11, 12], 1)
    const custom = { ...main, headline: { value: 10.5, previous: null, period: '2026-07-01' } }
    const earlier = monthlySeries(['2025-07-01', '2025-08-01', '2025-09-01'], [5, 6, 7], 1)
    expect(pairedHeadline(custom, custom.headline, earlier, earlier.headline, '1y')).toBeNull()

    const unmatched = monthlySeries(['2025-09-01', '2025-10-01', '2025-11-01'], [5, 6, 7], 1)
    expect(pairedHeadline(main, main.headline, unmatched, unmatched.headline, '1y')).toBeNull()
    expect(pairedHeadline(main, main.headline, null, null, '1y')).toBeNull()
  })

  it('matches trailing-window headlines within the window-end tolerance', () => {
    const windowEnd = { xMeaning: 'window-end', windowDays: 28 }
    const main = monthlySeries(['2026-08-01', '2026-09-01', '2026-09-25'], [10, 11, 12], 2, { ...windowEnd, partialLast: false })
    const earlier = monthlySeries(['2025-08-01', '2025-09-01', '2025-09-26'], [5, 6, 7], 2, { ...windowEnd, partialLast: false })
    expect(pairedHeadline(main, main.headline, earlier, earlier.headline, '1y')).toBe(earlier.headline)
  })

  it('takes undated headlines and period phrases as they are', () => {
    const kpi = { display: 'kpi', data: { value: 3 } }
    const earlierKpi = { display: 'kpi', data: { value: 2 } }
    expect(pairedHeadline(kpi, { value: 3, period: null }, earlierKpi, { value: 2, period: null }, '1y')).toEqual({ value: 2, period: null })
    expect(pairedHeadline(kpi, { value: 3, period: 'last 30 days' }, earlierKpi, { value: 2, period: 'last 30 days' }, '6m')).toEqual({ value: 2, period: 'last 30 days' })
    expect(pairedHeadline(kpi, { value: 3, period: null }, earlierKpi, { value: null, period: null }, '1y')).toBeNull()
  })
})
