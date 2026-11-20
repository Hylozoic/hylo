import { expect } from 'chai'
import { fillPoints, utcDay, utcRange, windows, startOfWeek } from '../../../../lib/analytics/periods'
import { hideSmallCohorts, MIN_COHORT } from '../../../../lib/analytics/readMetrics'

describe('fillPoints', () => {
  it('fills missing days with null and keeps stored values', () => {
    const points = fillPoints(
      [{ periodStart: '2026-10-02', value: 4 }],
      { from: '2026-10-01', to: '2026-10-03', period: 'day' }
    )
    expect(points.map(point => point.value)).to.deep.equal([null, 4, null])
  })

  it('starts a week on Monday', () => {
    expect(utcDay(startOfWeek(new Date('2026-10-28T00:00:00Z')))).to.equal('2026-10-26')
  })
})

describe('utcRange', () => {
  it('treats a date-only range as midnight UTC', () => {
    expect(utcRange('2014-01-01', '2015-01-01')).to.deep.equal({
      fromDay: '2014-01-01',
      toDay: '2015-01-01',
      fromTs: '2014-01-01T00:00:00.000Z',
      toTs: '2015-01-01T00:00:00.000Z'
    })
  })
})

describe('windows', () => {
  it('splits a range into month-sized chunks', () => {
    const chunks = windows('2026-01-01', '2026-03-01', 31)
    expect(chunks).to.have.length(2)
    expect(chunks[0].from.startsWith('2026-01-01')).to.equal(true)
    expect(chunks[1].to.startsWith('2026-03-01')).to.equal(true)
  })
})

describe('hideSmallCohorts', () => {
  it('hides a group cohort below the minimum and leaves the platform alone', () => {
    const series = [
      { metric: 'contributor_cohort', points: [{ value: MIN_COHORT - 1 }, { value: 20 }] },
      { metric: 'contributor_retained', points: [{ value: 1 }, { value: 10 }] }
    ]
    hideSmallCohorts(series, 5)
    expect(series[0].points[0].value).to.equal(null)
    expect(series[1].points[0].value).to.equal(null)
    expect(series[0].points[1].value).to.equal(20)

    const platform = [
      { metric: 'contributor_cohort', points: [{ value: 1 }] },
      { metric: 'contributor_retained', points: [{ value: 1 }] }
    ]
    hideSmallCohorts(platform, 0)
    expect(platform[0].points[0].value).to.equal(1)
  })
})
