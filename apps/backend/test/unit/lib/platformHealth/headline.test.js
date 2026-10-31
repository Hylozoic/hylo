/* eslint-env mocha */
const { expect } = require('chai')
const computeHeadline = require('../../../../lib/platformHealth/headline').default

describe('platformHealth/headline', () => {
  it('returns null when there is no data', () => {
    expect(computeHeadline({ display: 'kpi' }, null)).to.equal(null)
    expect(computeHeadline({ display: 'kpi' }, undefined)).to.equal(null)
  })

  it('returns null for display types without a generic rule', () => {
    expect(computeHeadline({ display: 'funnel' }, { steps: [{ label: 'a', value: 1 }] })).to.equal(null)
    expect(computeHeadline({ display: 'table' }, { columns: [], rows: [] })).to.equal(null)
  })

  describe('kpi', () => {
    const metric = { display: 'kpi' }

    it('uses value and previous', () => {
      expect(computeHeadline(metric, { value: 42, previous: 40 })).to.deep.equal({ value: 42, previous: 40 })
    })

    it('uses null previous when absent or not a number', () => {
      expect(computeHeadline(metric, { value: 0.5 })).to.deep.equal({ value: 0.5, previous: null })
      expect(computeHeadline(metric, { value: 0.5, previous: null })).to.deep.equal({ value: 0.5, previous: null })
      expect(computeHeadline(metric, { value: 0.5, previous: '0.4' })).to.deep.equal({ value: 0.5, previous: null })
    })

    it('returns null when value is null, a string or not finite', () => {
      expect(computeHeadline(metric, { value: null })).to.equal(null)
      expect(computeHeadline(metric, { value: '42' })).to.equal(null)
      expect(computeHeadline(metric, { value: NaN })).to.equal(null)
      expect(computeHeadline(metric, { value: Infinity })).to.equal(null)
    })

    it('treats zero as a real value', () => {
      expect(computeHeadline(metric, { value: 0, previous: 0 })).to.deep.equal({ value: 0, previous: 0 })
    })
  })

  describe('series', () => {
    const metric = { display: 'series' }
    const x = ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23']

    it('uses the last value vs the previous one when the last bucket is complete', () => {
      const data = {
        granularity: 'week',
        x,
        lines: [{ key: 'count', label: 'Count', primary: true, values: [1, 2, 3, 4] }],
        partialLast: false
      }
      expect(computeHeadline(metric, data)).to.deep.equal({ value: 4, previous: 3, period: '2026-03-23' })
    })

    it('skips the partial last bucket', () => {
      const data = {
        granularity: 'week',
        x,
        lines: [{ key: 'count', label: 'Count', primary: true, values: [1, 2, 3, 99] }],
        partialLast: true
      }
      expect(computeHeadline(metric, data)).to.deep.equal({ value: 3, previous: 2, period: '2026-03-16' })
    })

    it('uses the primary line rather than the first line', () => {
      const data = {
        granularity: 'week',
        x,
        lines: [
          { key: 'avg', label: 'Rolling average', values: [10, 20, 30, 40] },
          { key: 'count', label: 'Count', primary: true, values: [1, 2, 3, 4] }
        ],
        partialLast: false
      }
      expect(computeHeadline(metric, data)).to.deep.equal({ value: 4, previous: 3, period: '2026-03-23' })
    })

    it('falls back to the first line when none is primary', () => {
      const data = {
        granularity: 'week',
        x,
        lines: [{ key: 'a', label: 'A', values: [5, 6, 7, 8] }, { key: 'b', label: 'B', values: [1, 1, 1, 1] }],
        partialLast: false
      }
      expect(computeHeadline(metric, data)).to.deep.equal({ value: 8, previous: 7, period: '2026-03-23' })
    })

    it('skips null values and reports the period of the value used', () => {
      const data = {
        granularity: 'week',
        x,
        lines: [{ key: 'rate', label: 'Rate', primary: true, values: [0.2, null, 0.4, null] }],
        partialLast: false
      }
      expect(computeHeadline(metric, data)).to.deep.equal({ value: 0.4, previous: 0.2, period: '2026-03-16' })
    })

    it('returns null previous when only one complete value exists', () => {
      const data = {
        granularity: 'month',
        x: ['2026-02-01', '2026-03-01'],
        lines: [{ key: 'count', label: 'Count', primary: true, values: [7, 9] }],
        partialLast: true
      }
      expect(computeHeadline(metric, data)).to.deep.equal({ value: 7, previous: null, period: '2026-02-01' })
    })

    it('returns null when every value is null or the only value is partial', () => {
      expect(computeHeadline(metric, {
        x,
        lines: [{ key: 'c', primary: true, values: [null, null, null, null] }],
        partialLast: false
      })).to.equal(null)
      expect(computeHeadline(metric, {
        x: ['2026-03-23'],
        lines: [{ key: 'c', primary: true, values: [5] }],
        partialLast: true
      })).to.equal(null)
    })

    it('returns null when there are no lines', () => {
      expect(computeHeadline(metric, { x, lines: [], partialLast: false })).to.equal(null)
    })
  })

  describe('cohort', () => {
    const metric = { display: 'cohort' }

    it('uses the first value of the last row vs the row before', () => {
      const data = {
        columns: ['Week 1', 'Week 2'],
        rows: [
          { label: '2026-01-01', size: 100, values: [0.5, 0.3] },
          { label: '2026-02-01', size: 120, values: [0.6, 0.4] },
          { label: '2026-03-01', size: 90, values: [0.55, null] }
        ]
      }
      expect(computeHeadline(metric, data)).to.deep.equal({ value: 0.55, previous: 0.6, period: '2026-03-01' })
    })

    it('skips rows whose first value is null', () => {
      const data = {
        columns: ['Rate'],
        rows: [
          { label: '2026-01-01', size: 100, values: [0.5] },
          { label: '2026-02-01', size: 3, values: [null] }
        ]
      }
      expect(computeHeadline(metric, data)).to.deep.equal({ value: 0.5, previous: null, period: '2026-01-01' })
    })

    it('returns null when no row has a value', () => {
      expect(computeHeadline(metric, { columns: ['Rate'], rows: [] })).to.equal(null)
      expect(computeHeadline(metric, { columns: ['Rate'], rows: [{ label: 'x', size: 1, values: [null] }] })).to.equal(null)
    })
  })

  describe('metric-provided headline', () => {
    it('overrides the generic rule', () => {
      const data = { value: 10, previous: 5, custom: 3 }
      const metric = {
        display: 'kpi',
        headline: d => ({ value: d.custom, previous: null, period: 'custom' })
      }
      expect(computeHeadline(metric, data)).to.deep.equal({ value: 3, previous: null, period: 'custom' })
    })

    it('is called with the data', () => {
      const data = { steps: [] }
      const headline = spy(() => null)
      expect(computeHeadline({ display: 'funnel', headline }, data)).to.equal(null)
      expect(headline).to.have.been.called.with(data)
    })

    it('is not called when data is null', () => {
      const headline = spy(() => ({ value: 1 }))
      expect(computeHeadline({ display: 'kpi', headline }, null)).to.equal(null)
      expect(headline).not.to.have.been.called()
    })
  })
})
