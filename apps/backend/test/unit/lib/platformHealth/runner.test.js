/* eslint-env mocha */
const { expect } = require('chai')
const path = require('path')
const Module = require('module')

const libDir = path.resolve(__dirname, '../../../../lib/platformHealth')
const sectionsPath = require.resolve(path.join(libDir, 'sections'))
const runnerPath = require.resolve(path.join(libDir, 'runner'))

// Swap the sections registry for stub sections by seeding require.cache, then
// load a fresh copy of the runner that picks them up. (mock-require is avoided
// because its loader hook breaks mocha's ESM file loading on Node 24.)
function loadRunnerWithSections (sections) {
  const saved = { sections: require.cache[sectionsPath], runner: require.cache[runnerPath] }
  const stub = new Module(sectionsPath)
  stub.filename = sectionsPath
  stub.loaded = true
  stub.exports = sections
  require.cache[sectionsPath] = stub
  delete require.cache[runnerPath]
  const runner = require(runnerPath)
  const restore = () => {
    for (const [key, file] of [['sections', sectionsPath], ['runner', runnerPath]]) {
      if (saved[key]) require.cache[file] = saved[key]
      else delete require.cache[file]
    }
  }
  return { runner, restore }
}

const ASOF = '2026-03-27T00:00:00.000Z'
const LITERAL = `('${ASOF}'::timestamptz)`

const kpiMetric = {
  id: 'stub_kpi',
  label: 'Stub KPI',
  display: 'kpi',
  unit: 'count',
  goodDirection: 'up',
  sql: 'select count(*) as n, 3 as prev from users where created_at < :asOf -- STUB_KPI',
  transform: rows => ({ value: Number(rows[0].n), previous: Number(rows[0].prev) })
}

const seriesMetric = {
  id: 'stub_series',
  label: 'Stub series',
  display: 'series',
  unit: 'count',
  goodDirection: 'up',
  sql: 'select week, n from weeks where week <= date_trunc(\'week\', :asOf) and settings ? \'x\' -- STUB_SERIES',
  transform: (rows, { asOf }) => ({
    granularity: 'week',
    x: rows.map(r => r.week),
    lines: [{ key: 'n', label: 'N', primary: true, values: rows.map(r => Number(r.n)) }],
    partialLast: true,
    asOfSeen: asOf
  })
}

const overrideMetric = {
  id: 'stub_override',
  label: 'Stub override',
  display: 'kpi',
  unit: 'percent',
  goodDirection: 'up',
  sql: 'select 1 as n -- STUB_OVERRIDE',
  transform: rows => ({ value: Number(rows[0].n), previous: null }),
  headline: data => ({ value: data.value * 100, previous: null, period: 'custom' })
}

const failingMetric = {
  id: 'stub_failing',
  label: 'Stub failing',
  display: 'kpi',
  unit: 'count',
  goodDirection: 'up',
  sql: 'select boom -- STUB_FAIL',
  transform: rows => ({ value: 1 })
}

const throwingTransformMetric = {
  id: 'stub_bad_transform',
  label: 'Stub bad transform',
  display: 'kpi',
  unit: 'count',
  goodDirection: 'up',
  sql: 'select 1 as n -- STUB_BAD_TRANSFORM',
  transform: () => { throw new Error('transform exploded') }
}

const stubSections = [
  {
    section: { id: 'stub_a', title: 'Stub A', question: 'Is it alive?' },
    metrics: [kpiMetric, seriesMetric, failingMetric]
  },
  {
    section: { id: 'stub_b', title: 'Stub B', question: 'Is it trusted?' },
    metrics: [overrideMetric, throwingTransformMetric]
  }
]

function fakeKnex () {
  const transactions = []
  const knex = {
    transactions,
    transaction: async fn => {
      const statements = []
      transactions.push(statements)
      const trx = {
        raw: async sql => {
          statements.push(sql)
          if (sql.includes('STUB_FAIL')) throw new Error('column "boom" does not exist')
          if (sql.includes('STUB_KPI')) return { rows: [{ n: '42', prev: '3' }] }
          if (sql.includes('STUB_SERIES')) return { rows: [{ week: '2026-03-16', n: '5' }, { week: '2026-03-23', n: '7' }] }
          if (sql.includes('STUB_OVERRIDE') || sql.includes('STUB_BAD_TRANSFORM')) return { rows: [{ n: '0.25' }] }
          return { rows: [] }
        }
      }
      return fn(trx)
    }
  }
  return knex
}

describe('platformHealth/runner', () => {
  let runPlatformHealth, restore, knex

  before(() => {
    const loaded = loadRunnerWithSections(stubSections)
    runPlatformHealth = loaded.runner.runPlatformHealth
    restore = loaded.restore
  })

  after(() => restore())

  beforeEach(() => {
    knex = fakeKnex()
  })

  const metricFrom = (result, id) => result.sections.flatMap(s => s.metrics).find(m => m.id === id)

  it('runs each metric in a read-only transaction with a statement timeout before the query', async () => {
    await runPlatformHealth({ knex, asOf: '2026-03-27', metricIds: ['stub_kpi'] })
    expect(knex.transactions).to.have.length(1)
    const [statements] = knex.transactions
    expect(statements).to.have.length(3)
    expect(statements[0]).to.equal('set transaction read only')
    expect(statements[1]).to.match(/^set local statement_timeout = \d+$/)
    expect(statements[2]).to.contain('STUB_KPI')
  })

  it('substitutes :asOf and escapes ? in the metric SQL', async () => {
    await runPlatformHealth({ knex, asOf: '2026-03-27', metricIds: ['stub_series'] })
    const sql = knex.transactions[0][2]
    expect(sql).to.contain(`date_trunc('week', ${LITERAL})`)
    expect(sql).to.contain('settings \\? \'x\'')
    expect(sql).not.to.contain(':asOf')
  })

  it('puts transform output in data, passes asOf to transform, and computes headlines', async () => {
    const result = await runPlatformHealth({ knex, asOf: '2026-03-27', sectionIds: ['stub_a'], metricIds: ['stub_kpi', 'stub_series'] })

    expect(result.asOf).to.equal(ASOF)
    expect(result.sections.map(s => s.id)).to.deep.equal(['stub_a'])

    const kpi = metricFrom(result, 'stub_kpi')
    expect(kpi.data).to.deep.equal({ value: 42, previous: 3 })
    expect(kpi.headline).to.deep.equal({ value: 42, previous: 3 })
    expect(kpi.error).to.equal(null)
    expect(kpi.runtimeMs).to.be.a('number')

    const series = metricFrom(result, 'stub_series')
    expect(series.data.x).to.deep.equal(['2026-03-16', '2026-03-23'])
    expect(series.data.lines[0].values).to.deep.equal([5, 7])
    expect(series.data.asOfSeen).to.equal(ASOF)
    // last bucket is partial, so the headline uses the previous complete week
    expect(series.headline).to.deep.equal({ value: 5, previous: null, period: '2026-03-16' })
  })

  it('uses a metric-provided headline', async () => {
    const result = await runPlatformHealth({ knex, asOf: '2026-03-27', metricIds: ['stub_override'] })
    const metric = metricFrom(result, 'stub_override')
    expect(metric.data).to.deep.equal({ value: 0.25, previous: null })
    expect(metric.headline).to.deep.equal({ value: 25, previous: null, period: 'custom' })
  })

  it('reports a failing query as an error while other metrics still succeed', async () => {
    const result = await runPlatformHealth({ knex, asOf: '2026-03-27' })

    const failing = metricFrom(result, 'stub_failing')
    expect(failing.error).to.equal('column "boom" does not exist')
    expect(failing.data).to.equal(null)
    expect(failing.headline).to.equal(null)

    const badTransform = metricFrom(result, 'stub_bad_transform')
    expect(badTransform.error).to.equal('transform exploded')
    expect(badTransform.data).to.equal(null)

    expect(metricFrom(result, 'stub_kpi').error).to.equal(null)
    expect(metricFrom(result, 'stub_kpi').data).to.deep.equal({ value: 42, previous: 3 })
    expect(metricFrom(result, 'stub_series').error).to.equal(null)
    expect(metricFrom(result, 'stub_override').error).to.equal(null)
    expect(knex.transactions).to.have.length(5)
  })

  it('strips the query knex prefixes onto database errors', () => {
    const { cleanErrorMessage } = require('../../../../lib/platformHealth/runner')
    expect(cleanErrorMessage(new Error('with p as (select now() - interval \'1 day\') select 1 - relation "user_activity_days" does not exist')))
      .to.equal('relation "user_activity_days" does not exist')
    expect(cleanErrorMessage(new Error('transform exploded'))).to.equal('transform exploded')
    expect(cleanErrorMessage(new Error('canceling statement - timeout'))).to.equal('canceling statement - timeout')
  })

  it('preserves section and metric order and strips sql/transform/headline from the output', async () => {
    const result = await runPlatformHealth({ knex, asOf: '2026-03-27', concurrency: 2 })
    expect(result.sections.map(s => s.id)).to.deep.equal(['stub_a', 'stub_b'])
    expect(result.sections[0].title).to.equal('Stub A')
    expect(result.sections[0].metrics.map(m => m.id)).to.deep.equal(['stub_kpi', 'stub_series', 'stub_failing'])
    expect(result.sections[1].metrics.map(m => m.id)).to.deep.equal(['stub_override', 'stub_bad_transform'])
    result.sections.forEach(s => s.metrics.forEach(m => {
      expect(m).not.to.have.property('sql')
      expect(m).not.to.have.property('transform')
      expect(m).to.have.property('label')
      expect(m).to.have.property('display')
    }))
    expect(metricFrom(result, 'stub_override').headline).to.deep.equal({ value: 25, previous: null, period: 'custom' })
    expect(result).to.include.keys('generatedAt', 'durationMs', 'northStar', 'antiMetrics', 'instrumentationGaps')
  })

  it('runs every metric even when given an unusable concurrency', async () => {
    for (const concurrency of [NaN, 0, -2, 1.5]) {
      const result = await runPlatformHealth({ knex: fakeKnex(), asOf: '2026-03-27', concurrency })
      expect(result.sections.flatMap(s => s.metrics).every(m => typeof m.runtimeMs === 'number')).to.equal(true)
    }
  })

  it('rejects an invalid asOf before running anything', async () => {
    await expect(runPlatformHealth({ knex, asOf: "2026-01-01'; drop table users;--" })).to.be.rejectedWith(/asOf must be/)
    expect(knex.transactions).to.have.length(0)
  })
})
