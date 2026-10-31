import React from 'react'
import { act, render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import PlatformHealth, { POLL_INTERVAL_MS, REQUEST_HEADERS, platformHealthUrl } from './PlatformHealth'
import { formatValue, formatChange, changeTone, formatPoint, isStrictIsoDate } from './format'

function seriesMetric (overrides = {}) {
  return {
    id: 'weekly_connected_members',
    label: 'Weekly connected members',
    definition: 'People on either side of a two-way interaction.',
    whyItMatters: 'It counts the moment Hylo creates value.',
    display: 'series',
    unit: 'count',
    goodDirection: 'up',
    vital: true,
    notes: 'The current week is partial.',
    runtimeMs: 120,
    error: null,
    data: {
      granularity: 'week',
      x: ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23'],
      lines: [
        { key: 'wcm', label: 'Connected members', values: [300, 320, 1381, 90], primary: true },
        { key: 'avg', label: '4-week average', values: [290, 300, 500, 530] }
      ],
      partialLast: true
    },
    headline: { value: 1381, previous: 320, period: '2026-03-16' },
    ...overrides
  }
}

const fixture = {
  status: 'ready',
  cached: true,
  asOf: '2026-03-27T00:00:00.000Z',
  generatedAt: '2026-03-27T12:00:00.000Z',
  durationMs: 4200,
  northStar: {
    metricId: 'weekly_connected_members',
    name: 'Weekly Connected Members',
    definition: 'People who were on either side of a two-way interaction in a week.',
    why: 'It grows only when real coordination grows.'
  },
  sections: [
    {
      id: 'network_alive',
      title: 'Network vitality',
      question: 'Is the network alive?',
      metrics: [
        seriesMetric(),
        {
          id: 'live_groups_linked',
          label: 'Live groups linked to another group',
          definition: 'Share of live groups with a parent or child relationship.',
          whyItMatters: 'Linked groups spread life.',
          display: 'kpi',
          unit: 'percent',
          goodDirection: 'up',
          vital: false,
          notes: null,
          runtimeMs: 40,
          error: null,
          data: { value: 0.25, numerator: 10, denominator: 40 },
          headline: { value: 0.25, previous: null, period: null }
        }
      ]
    },
    {
      id: 'finding_home',
      title: 'Arrival and activation',
      question: 'Are new people finding a home?',
      metrics: [
        {
          id: 'signup_joined_group_7d',
          label: 'Signups joining a group within 7 days',
          definition: 'Of completed signups, the share joining a group within 7 days.',
          whyItMatters: 'Without a group there is nothing to do.',
          display: 'kpi',
          unit: 'percent',
          goodDirection: 'up',
          vital: true,
          notes: null,
          runtimeMs: 50,
          error: null,
          data: { value: 0.534, previous: 0.5 },
          headline: { value: 0.534, previous: 0.5, period: null }
        },
        {
          id: 'signup_contributed_30d',
          label: 'Signups contributing within 30 days',
          definition: 'Cohort share.',
          whyItMatters: 'Activation.',
          display: 'cohort',
          unit: 'percent',
          goodDirection: 'up',
          vital: false,
          notes: null,
          runtimeMs: 60,
          error: null,
          data: { columns: ['Rate'], rows: [{ label: '2026-01-01', size: 120, values: [0.125] }, { label: '2026-02-01', size: 90, values: [null] }] },
          headline: { value: 0.125, previous: null, period: null }
        },
        {
          id: 'invite_k_proxy',
          label: 'Accepted invites per contributor (K proxy)',
          definition: 'Ratio.',
          whyItMatters: 'Growth.',
          display: 'series',
          unit: 'ratio',
          goodDirection: 'up',
          vital: false,
          notes: null,
          runtimeMs: 3100,
          error: 'canceling statement due to statement timeout',
          data: null,
          headline: null
        }
      ]
    },
    {
      id: 'stewards',
      title: 'Stewardship and safety',
      question: 'Are stewards present?',
      metrics: [
        {
          id: 'join_request_decision_time',
          label: 'Join request time to decision',
          definition: 'Median hours.',
          whyItMatters: 'Silence loses people.',
          display: 'kpi',
          unit: 'hours',
          goodDirection: 'down',
          vital: true,
          notes: null,
          runtimeMs: 30,
          error: null,
          data: { value: 12.25, previous: 20 },
          headline: { value: 12.25, previous: 20, period: null }
        },
        {
          id: 'steward_coverage',
          label: 'Steward coverage of active groups',
          definition: 'Groups by administrator count.',
          whyItMatters: 'Coverage.',
          display: 'table',
          unit: 'percent',
          goodDirection: 'up',
          vital: false,
          notes: null,
          runtimeMs: 30,
          error: null,
          data: { columns: [{ key: 'population', label: 'Groups' }, { key: 'none', label: 'No admin', unit: 'count' }], rows: [{ population: 'Active groups', none: 3 }] },
          headline: null
        },
        {
          id: 'moderation_health',
          label: 'Moderation backlog and report rate',
          definition: 'Table.',
          whyItMatters: 'Safety.',
          display: 'table',
          unit: 'count',
          goodDirection: 'down',
          vital: false,
          notes: null,
          runtimeMs: 30,
          error: null,
          data: { columns: [{ key: 'item', label: 'Item' }, { key: 'n', label: 'Count', unit: 'count' }], rows: [{ item: 'Open reports', n: 1234 }] },
          headline: null
        }
      ]
    }
  ],
  antiMetrics: ['Total registered users: they only go up.'],
  instrumentationGaps: [{ name: 'Daily user activity', why: 'last_active_at keeps only the latest visit.', capture: 'A user_activity_days row.' }]
}

function jsonResponse (status, body) {
  return Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) })
}

function deferred () {
  let settle
  const promise = new Promise(resolve => { settle = resolve })
  return { promise, resolve: value => settle(value) }
}

const fetchOptions = expect.objectContaining({ credentials: 'include', headers: { 'X-Requested-With': 'hylo-admin' } })
const urls = () => global.fetch.mock.calls.map(([url]) => url)

describe('PlatformHealth', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.useRealTimers()
  })

  it('renders the north star, vital tiles and sections', async () => {
    global.fetch = jest.fn(() => jsonResponse(200, fixture))
    render(<PlatformHealth />)

    expect(screen.getByRole('heading', { name: 'Platform health' })).toBeInTheDocument()
    expect(await screen.findByTestId('north-star')).toHaveTextContent('Weekly Connected Members')
    expect(global.fetch).toHaveBeenCalledWith('/noo/admin/platform-health', fetchOptions)
    expect(screen.getByTestId('cached-badge')).toBeInTheDocument()

    const tiles = ['signup_joined_group_7d', 'join_request_decision_time']
    tiles.forEach(id => expect(screen.getByTestId(`vital-tile-${id}`)).toBeInTheDocument())
    expect(screen.queryByTestId('vital-tile-live_groups_linked')).not.toBeInTheDocument()

    expect(within(screen.getByTestId('north-star')).getAllByText('1,381').length).toBeGreaterThan(0)
    expect(within(screen.getByTestId('vital-tile-join_request_decision_time')).getByText('12.3 hours')).toBeInTheDocument()

    const upGood = within(screen.getByTestId('north-star')).getByTestId('headline-change')
    expect(upGood).toHaveAttribute('data-tone', 'good')
    expect(upGood).toHaveTextContent('▲')
    // Good or bad is spelled out, not left to color alone
    expect(within(upGood).getByText('better', { selector: '[aria-hidden="true"]' })).toBeInTheDocument()
    const downGood = within(screen.getByTestId('vital-tile-join_request_decision_time')).getByTestId('headline-change')
    expect(downGood).toHaveAttribute('data-tone', 'good')
    expect(downGood).toHaveTextContent('▼')

    expect(screen.getByRole('heading', { name: 'Network vitality' })).toBeInTheDocument()
    expect(screen.getByText('Is the network alive?')).toBeInTheDocument()
    expect(screen.getByTestId('section-stewards')).toBeInTheDocument()
    expect(screen.getByText('Open reports')).toBeInTheDocument()
    expect(within(screen.getByTestId('metric-card-steward_coverage')).getByText('Active groups')).toBeInTheDocument()

    expect(screen.getByText('Total registered users: they only go up.')).toBeInTheDocument()
    expect(screen.getByText('Daily user activity')).toBeInTheDocument()

    const charts = screen.getAllByRole('img')
    expect(charts.some(chart => /1,381 \(Week of Mar 16, 2026\)\. 4-week average: 500\./.test(chart.getAttribute('aria-label')))).toBe(true)
    expect(screen.getAllByTestId('partial-point').length).toBeGreaterThan(0)
  })

  it('shows the report date and the generated time both in UTC', async () => {
    global.fetch = jest.fn(() => jsonResponse(200, { ...fixture, asOf: '2026-05-13T00:00:00.000Z', generatedAt: '2026-05-13T00:01:00.000Z' }))
    render(<PlatformHealth />)

    expect(await screen.findByText('Showing data as of May 13, 2026')).toBeInTheDocument()
    expect(screen.getByText('Generated May 13, 2026, 12:01 AM UTC')).toBeInTheDocument()
  })

  it('reveals the definition, why it matters and notes from the info button', async () => {
    global.fetch = jest.fn(() => jsonResponse(200, fixture))
    render(<PlatformHealth />)
    const card = await screen.findByTestId('metric-card-weekly_connected_members')
    const button = within(card).getByRole('button', { name: 'About Weekly connected members' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(within(card).getByText('It counts the moment Hylo creates value.')).toBeInTheDocument()
    expect(within(card).getByText('The current week is partial.')).toBeInTheDocument()
  })

  it('shows the computing state for 202 and renders the panel after polling', async () => {
    jest.useFakeTimers()
    global.fetch = jest.fn()
      .mockImplementationOnce(() => jsonResponse(202, { status: 'computing', startedAt: new Date().toISOString() }))
      .mockImplementationOnce(() => jsonResponse(202, { status: 'computing', startedAt: new Date().toISOString() }))
      .mockImplementation(() => jsonResponse(200, fixture))

    render(<PlatformHealth />)

    expect(await screen.findByTestId('computing-state')).toHaveTextContent('Computing the panel — this takes about a minute')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    // The ticking counter stays out of the live region, so it isn't announced every second
    expect(within(screen.getByTestId('computing-state')).getByRole('status')).toHaveTextContent('Computing the panel')
    expect(screen.getByText(/^Started \d+ s ago$/).closest('[aria-live]')).toBeNull()

    await act(async () => { jest.advanceTimersByTime(POLL_INTERVAL_MS) })
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('computing-state')).toBeInTheDocument()

    await act(async () => { jest.advanceTimersByTime(POLL_INTERVAL_MS) })
    expect(global.fetch).toHaveBeenCalledTimes(3)
    expect(global.fetch.mock.calls.every(([url]) => !url.includes('refresh'))).toBe(true)
    // Polling requests carry the admin header too
    global.fetch.mock.calls.forEach(([, options]) => expect(options.headers).toEqual(REQUEST_HEADERS))

    expect(await screen.findByTestId('north-star')).toBeInTheDocument()
    expect(screen.queryByTestId('computing-state')).not.toBeInTheDocument()
  })

  it('shows a server error with a Retry that asks for a refresh', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => jsonResponse(500, { status: 'error', error: 'database unavailable' }))
      .mockImplementation(() => jsonResponse(200, fixture))

    render(<PlatformHealth />)
    const errorBox = await screen.findByTestId('panel-error')
    expect(errorBox).toHaveTextContent('database unavailable')

    fireEvent.click(within(errorBox).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('north-star')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenLastCalledWith('/noo/admin/platform-health?refresh=1', fetchOptions)
  })

  it('sends the admin header on the initial load and on Refresh', async () => {
    global.fetch = jest.fn(() => jsonResponse(200, fixture))
    render(<PlatformHealth />)
    await screen.findByTestId('north-star')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByTestId('north-star')).toBeInTheDocument()
    expect(urls()).toEqual(['/noo/admin/platform-health', '/noo/admin/platform-health?refresh=1'])
    global.fetch.mock.calls.forEach(([, options]) => expect(options).toEqual(fetchOptions))
  })

  it('applies a past date only on View date or Enter, and returns to today', async () => {
    global.fetch = jest.fn(() => jsonResponse(200, fixture))
    render(<PlatformHealth />)
    await screen.findByTestId('north-star')
    expect(global.fetch).toHaveBeenCalledTimes(1)

    const input = screen.getByLabelText('View a past date')
    const viewButton = screen.getByRole('button', { name: 'View date' })
    expect(input).toHaveValue('2026-03-27')
    expect(viewButton).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument()

    // Stepping through days with the arrow keys fires change events; none of them may start a run
    fireEvent.change(input, { target: { value: '2026-03-26' } })
    fireEvent.change(input, { target: { value: '2026-03-25' } })
    fireEvent.change(input, { target: { value: '2026-03-24' } })
    expect(global.fetch).toHaveBeenCalledTimes(1)

    fireEvent.click(viewButton)
    expect(await screen.findByTestId('north-star')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenLastCalledWith('/noo/admin/platform-health?asOf=2026-03-24', fetchOptions)

    // Enter in the date field submits the form
    fireEvent.change(input, { target: { value: '2026-02-10' } })
    expect(global.fetch).toHaveBeenCalledTimes(2)
    fireEvent.submit(screen.getByTestId('as-of-form'))
    expect(await screen.findByTestId('north-star')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenLastCalledWith('/noo/admin/platform-health?asOf=2026-02-10', fetchOptions)

    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(await screen.findByTestId('north-star')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenLastCalledWith('/noo/admin/platform-health', fetchOptions)
    expect(global.fetch).toHaveBeenCalledTimes(4)
    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument()
  })

  it('does not apply an incomplete or future date', async () => {
    global.fetch = jest.fn(() => jsonResponse(200, fixture))
    render(<PlatformHealth />)
    await screen.findByTestId('north-star')
    const input = screen.getByLabelText('View a past date')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.submit(screen.getByTestId('as-of-form'))
    fireEvent.change(input, { target: { value: '2999-01-01' } })
    expect(screen.getByRole('button', { name: 'View date' })).toBeDisabled()
    fireEvent.submit(screen.getByTestId('as-of-form'))
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('cancels a superseded poll so its late result cannot overwrite the newer date', async () => {
    jest.useFakeTimers()
    const stale = deferred()
    const pastFixture = { ...fixture, asOf: '2026-03-20T00:00:00.000Z', northStar: { ...fixture.northStar, name: 'Past north star' } }
    global.fetch = jest.fn()
      .mockImplementationOnce(() => jsonResponse(202, { status: 'computing', startedAt: new Date().toISOString() }))
      .mockImplementationOnce(() => stale.promise)
      .mockImplementation(() => jsonResponse(200, pastFixture))

    render(<PlatformHealth />)
    expect(await screen.findByTestId('computing-state')).toBeInTheDocument()

    // The second poll of today is in flight when the user switches date
    await act(async () => { jest.advanceTimersByTime(POLL_INTERVAL_MS) })
    expect(global.fetch).toHaveBeenCalledTimes(2)
    const stalePollSignal = global.fetch.mock.calls[1][1].signal

    fireEvent.change(screen.getByLabelText('View a past date'), { target: { value: '2026-03-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'View date' }))
    expect(await screen.findByTestId('north-star')).toHaveTextContent('Past north star')
    expect(global.fetch).toHaveBeenLastCalledWith('/noo/admin/platform-health?asOf=2026-03-20', fetchOptions)
    expect(stalePollSignal.aborted).toBe(true)

    // The superseded request finally answers: it is ignored, and today's polling never resumes
    await act(async () => { stale.resolve({ status: 200, ok: true, json: () => Promise.resolve(fixture) }) })
    await act(async () => { jest.advanceTimersByTime(POLL_INTERVAL_MS * 3) })
    expect(screen.getByTestId('north-star')).toHaveTextContent('Past north star')
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('stops polling on unmount', async () => {
    jest.useFakeTimers()
    global.fetch = jest.fn(() => jsonResponse(202, { status: 'computing', startedAt: new Date().toISOString() }))
    const { unmount } = render(<PlatformHealth />)
    expect(await screen.findByTestId('computing-state')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledTimes(1)
    unmount()
    await act(async () => { jest.advanceTimersByTime(POLL_INTERVAL_MS * 3) })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('renders a metric error inside its card', async () => {
    global.fetch = jest.fn(() => jsonResponse(200, fixture))
    render(<PlatformHealth />)
    const card = await screen.findByTestId('metric-card-invite_k_proxy')
    expect(within(card).getByTestId('metric-error')).toHaveTextContent('canceling statement due to statement timeout')
    expect(screen.getByTestId('metric-card-signup_contributed_30d')).toBeInTheDocument()
  })

  it('moves focus to the card when a vital tile is activated', async () => {
    global.fetch = jest.fn(() => jsonResponse(200, fixture))
    render(<PlatformHealth />)
    const tile = await screen.findByTestId('vital-tile-join_request_decision_time')
    fireEvent.click(tile)
    expect(document.activeElement).toBe(screen.getByTestId('metric-card-join_request_decision_time'))
  })

  it('reads plotted secondary lines to screen readers and lists far larger ones below the chart', async () => {
    const missed = seriesMetric({
      id: 'weekly_missed_connections',
      label: 'Weekly missed connections',
      vital: false,
      data: {
        granularity: 'week',
        x: ['2026-03-09', '2026-03-16'],
        lines: [
          { key: 'missed', label: 'Missed people', values: [50, 49], primary: true },
          { key: 'posters', label: 'People who posted', values: [220, 227] },
          { key: 'isolated', label: 'Isolated', values: [20, 18] }
        ],
        partialLast: false
      },
      headline: { value: 49, previous: 50, period: '2026-03-16' }
    })
    const body = { ...fixture, sections: [...fixture.sections, { id: 'missed', title: 'Missed', question: null, metrics: [missed] }] }
    global.fetch = jest.fn(() => jsonResponse(200, body))
    render(<PlatformHealth />)
    const card = await screen.findByTestId('metric-card-weekly_missed_connections')
    expect(within(card).getByRole('img').getAttribute('aria-label')).toBe('Weekly missed connections: 50 (Week of Mar 9, 2026), 49 (Week of Mar 16, 2026). Isolated: 18.')
    expect(within(card).getByRole('list', { name: 'Legend' })).not.toHaveTextContent('People who posted')
    expect(within(card).getByRole('term')).toHaveTextContent('People who posted')
    expect(within(card).getByRole('definition')).toHaveTextContent('227')
  })

  it('names the window of a KPI or table headline that covers one', async () => {
    const [networkAlive, ...rest] = fixture.sections
    const linked = { ...networkAlive.metrics[1], headline: { value: 0.25, previous: null, period: '2026-03-23', windowDays: 28 } }
    const body = { ...fixture, sections: [{ ...networkAlive, metrics: [networkAlive.metrics[0], linked] }, ...rest] }
    global.fetch = jest.fn(() => jsonResponse(200, body))
    render(<PlatformHealth />)
    expect(within(await screen.findByTestId('metric-card-live_groups_linked')).getByText('28 days to Mar 23, 2026')).toBeInTheDocument()
  })

  it('shows the north star only in the hero, not in the vital signs, and keeps its section card', async () => {
    global.fetch = jest.fn(() => jsonResponse(200, fixture))
    render(<PlatformHealth />)
    expect(await screen.findByTestId('north-star')).toBeInTheDocument()
    expect(screen.queryByTestId('vital-tile-weekly_connected_members')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('section-network_alive')).getByTestId('metric-card-weekly_connected_members')).toBeInTheDocument()
    expect(screen.getByTestId('vital-tile-signup_joined_group_7d')).toBeInTheDocument()
  })

  it('labels trailing-window series points as "to <date>"', async () => {
    const windowMetric = seriesMetric({
      id: 'active_contributors_28d',
      label: 'Active contributors (28 days)',
      vital: true,
      data: {
        granularity: 'week',
        xMeaning: 'window-end',
        windowDays: 28,
        x: ['2026-03-01', '2026-03-08', '2026-03-15', '2026-03-22'],
        lines: [{ key: 'n', label: 'Contributors', values: [40, 42, 45, 47], primary: true }],
        partialLast: false
      },
      headline: { value: 47, previous: 45, period: '2026-03-22' }
    })
    const body = { ...fixture, sections: [{ ...fixture.sections[0], metrics: [...fixture.sections[0].metrics, windowMetric] }, ...fixture.sections.slice(1)] }
    global.fetch = jest.fn(() => jsonResponse(200, body))
    render(<PlatformHealth />)

    const card = await screen.findByTestId('metric-card-active_contributors_28d')
    expect(within(card).getByText('28 days to Mar 22, 2026')).toBeInTheDocument()
    expect(within(card).getByTestId('x-axis-start')).toHaveTextContent('to Mar 1, 2026')
    expect(within(card).getByTestId('x-axis-end')).toHaveTextContent('to Mar 22, 2026')
    const tooltips = Array.from(card.querySelectorAll('title')).map(node => node.textContent)
    expect(tooltips[tooltips.length - 1]).toMatch(/^28 days to Mar 22, 2026\nContributors: 47$/)
    expect(within(card).getByRole('img').getAttribute('aria-label')).toBe('Active contributors (28 days): 40 (28 days to Mar 1, 2026), 47 (28 days to Mar 22, 2026).')
    expect(within(screen.getByTestId('vital-tile-active_contributors_28d')).getByText('28 days to Mar 22, 2026')).toBeInTheDocument()

    const bucketCard = screen.getByTestId('metric-card-weekly_connected_members')
    expect(within(bucketCard).getByText('Week of Mar 16, 2026')).toBeInTheDocument()
    expect(within(bucketCard).getByTestId('x-axis-start')).toHaveTextContent('Mar 2, 2026')
    expect(within(bucketCard).getByTestId('x-axis-start')).not.toHaveTextContent('to ')
  })

  it('colors cohort columns by their own direction', async () => {
    const cohortMetric = {
      id: 'new_member_first_post',
      label: 'New members posting in their first 30 days',
      definition: 'Cohort.',
      whyItMatters: 'Activation.',
      display: 'cohort',
      unit: 'percent',
      goodDirection: 'up',
      vital: true,
      notes: null,
      runtimeMs: 20,
      error: null,
      data: {
        columns: ['Posted', 'No post in 30 days'],
        columnDirections: ['down', 'down'],
        rows: [{ label: '2026-01-01', size: 100, values: [0.2, 0.8] }, { label: '2026-02-01', size: 90, values: [0.3, 0.7] }]
      },
      headline: { value: 0.3, previous: 0.2, period: null }
    }
    const upColumns = { ...cohortMetric, id: 'cohort_up', label: 'Cohort up', vital: false, data: { ...cohortMetric.data, columnDirections: ['up', 'down'] } }
    const plain = { ...cohortMetric, id: 'cohort_plain', label: 'Cohort plain', vital: false, data: { ...cohortMetric.data, columnDirections: undefined } }
    const body = { ...fixture, sections: [...fixture.sections, { id: 'cohorts', title: 'Cohorts', question: null, metrics: [cohortMetric, upColumns, plain] }] }
    global.fetch = jest.fn(() => jsonResponse(200, body))
    render(<PlatformHealth />)

    const shades = id => Array.from(screen.getByTestId(`metric-card-${id}`).querySelectorAll('td[data-shade]')).map(td => td.getAttribute('data-shade'))
    expect(await screen.findByTestId('metric-card-cohort_up')).toBeInTheDocument()
    expect(shades('cohort_up')).toEqual(['accent', 'neutral', 'accent', 'neutral'])
    expect(shades('cohort_plain')).toEqual(['accent', 'accent', 'accent', 'accent'])
    expect(shades('new_member_first_post')).toEqual(['neutral', 'neutral', 'neutral', 'neutral'])
    expect(within(screen.getByTestId('metric-card-cohort_up')).getByRole('columnheader', { name: 'No post in 30 days' })).toHaveAttribute('title', 'Lower is better')
    expect(within(screen.getByTestId('metric-card-cohort_up')).getByText('↓ Lower is better')).toBeInTheDocument()
    expect(within(screen.getByTestId('metric-card-cohort_plain')).queryByText('↓ Lower is better')).not.toBeInTheDocument()

    // The cohort headline is the first column, so its change follows that column's direction
    expect(within(screen.getByTestId('vital-tile-new_member_first_post')).getByTestId('headline-change')).toHaveAttribute('data-tone', 'bad')
    expect(within(screen.getByTestId('metric-card-cohort_up')).getByTestId('headline-change')).toHaveAttribute('data-tone', 'good')
  })

  it('shows a headline period phrase verbatim', async () => {
    const withPeriod = (metric, period) => ({ ...metric, headline: { ...metric.headline, period } })
    const [networkAlive, findingHome, ...rest] = fixture.sections
    const body = {
      ...fixture,
      sections: [
        { ...networkAlive, metrics: [networkAlive.metrics[0], withPeriod(networkAlive.metrics[1], 'as of 2026-03-27')] },
        { ...findingHome, metrics: [withPeriod(findingHome.metrics[0], 'last 30 days'), ...findingHome.metrics.slice(1)] },
        ...rest
      ]
    }
    global.fetch = jest.fn(() => jsonResponse(200, body))
    render(<PlatformHealth />)

    expect(within(await screen.findByTestId('vital-tile-signup_joined_group_7d')).getByText('last 30 days')).toBeInTheDocument()
    expect(within(screen.getByTestId('metric-card-signup_joined_group_7d')).getByText('last 30 days')).toBeInTheDocument()
    expect(within(screen.getByTestId('metric-card-live_groups_linked')).getByText('as of 2026-03-27')).toBeInTheDocument()
  })

  it('formats each series line by its own unit', async () => {
    const mixed = seriesMetric({
      id: 'mixed_units',
      label: 'Mixed units',
      vital: false,
      data: {
        granularity: 'week',
        x: ['2026-03-09', '2026-03-16'],
        lines: [
          { key: 'n', label: 'Contributors', values: [10, 12], primary: true },
          { key: 'share', label: 'Share of members', values: [0.1, 0.125], unit: 'percent' }
        ],
        partialLast: false
      },
      headline: { value: 12, previous: 10, period: '2026-03-16' }
    })
    const body = { ...fixture, sections: [...fixture.sections, { id: 'mixed', title: 'Mixed', question: null, metrics: [mixed] }] }
    global.fetch = jest.fn(() => jsonResponse(200, body))
    render(<PlatformHealth />)
    const card = await screen.findByTestId('metric-card-mixed_units')
    expect(within(card).getByText('12.5%')).toBeInTheDocument()
  })

  it('shows a series that has no data yet, with its note, without crashing', async () => {
    const empty = seriesMetric({
      id: 'active_users_trend',
      label: 'Active users',
      vital: false,
      data: {
        granularity: 'week',
        x: ['2026-09-14', '2026-09-21'],
        lines: [
          { key: 'mau', label: 'Monthly active users', values: [null, null], primary: true },
          { key: 'wau', label: 'Weekly active users', values: [null, null] }
        ],
        partialLast: true,
        note: 'No activity has been recorded yet; this fills in from the day the tracking change is deployed.'
      },
      headline: null
    })
    const body = { ...fixture, sections: [...fixture.sections, { id: 'audience', title: 'Audience', question: null, metrics: [empty] }] }
    global.fetch = jest.fn(() => jsonResponse(200, body))
    render(<PlatformHealth />)
    const card = await screen.findByTestId('metric-card-active_users_trend')
    expect(within(card).getByTestId('data-note')).toHaveTextContent('No activity has been recorded yet')
    expect(within(card).queryByText(/could not be displayed/)).not.toBeInTheDocument()
  })

  it('formats percent headlines from fractions', async () => {
    global.fetch = jest.fn(() => jsonResponse(200, fixture))
    render(<PlatformHealth />)
    const tile = await screen.findByTestId('vital-tile-signup_joined_group_7d')
    expect(within(tile).getByText('53.4%')).toBeInTheDocument()
    expect(within(tile).getByTestId('headline-change')).toHaveTextContent('3.4 pts')
    expect(within(screen.getByTestId('metric-card-signup_contributed_30d')).getAllByText('12.5%').length).toBeGreaterThan(0)
  })
})

const DAY_MS = 24 * 60 * 60 * 1000

// Mondays of the four weeks up to the week of `asOf`, the last of them in progress
function weeksEnding (asOf) {
  const day = new Date(`${asOf.slice(0, 10)}T00:00:00Z`)
  const monday = day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS
  return [21, 14, 7, 0].map(days => new Date(monday - days * DAY_MS).toISOString().slice(0, 10))
}

const extraMetrics = [
  { id: 'weekly_active_contributors', label: 'Weekly active contributors', display: 'series', unit: 'count', goodDirection: 'up', vital: true },
  { id: 'quiet_signal', label: 'Quiet signal', display: 'series', unit: 'count', goodDirection: 'up', vital: true },
  { id: 'group_links', label: 'Group links', display: 'kpi', unit: 'count', goodDirection: 'up', vital: false },
  { id: 'unsubscribe_all_leak', label: 'Unsubscribe-all users still receiving push or email', display: 'kpi', unit: 'count', goodDirection: 'down', vital: false, comparable: false }
].map(metric => ({ definition: 'Definition.', whyItMatters: 'Why.', notes: null, runtimeMs: 10, error: null, ...metric }))

// The numbers now and a period earlier. The earlier breakdown is in another order, has a quarter a period
// back, and has the current quarter too (as a six-month-earlier panel would)
const NUMBERS = {
  now: {
    wcm: [300, 320, 1381, 90],
    avg: [290, 300, 500, 530],
    share: [0.1, 0.11, 0.12, 0.05],
    wac: [40, 42, 45, 20],
    links: [['Linked groups', 374], ['Peer links', 1275], ['New links, 2026-Q1', 40], ['Added since', 5]],
    leak: 44
  },
  earlier: {
    wcm: [200, 1500, 250, 60],
    avg: [190, 200, 220, 230],
    share: [0.08, 0.09, 0.1, 0.04],
    wac: [30, 31, 35, 10],
    links: [['Peer links', 1000], ['Linked groups', 300], ['New links, 2025-Q1', 30], ['New links, 2026-Q1', 99]],
    leak: 0,
    joined: 0.4,
    decisionHours: 30
  }
}

// The panel as of `asOf`, with weekly series ending in that week. The earlier panel lacks live_groups_linked,
// and its north-star headline is a week off from the matching one, so it has to be paired by period.
function buildPanel (asOf, which = 'now') {
  const n = NUMBERS[which]
  const x = weeksEnding(asOf)
  const weekly = lines => ({
    data: { granularity: 'week', x, lines, partialLast: true },
    headline: { value: lines[0].values[2], previous: lines[0].values[1], period: x[2] }
  })
  const kpi = (value, period, extra = {}) => ({ data: { value, ...extra }, headline: { value, previous: null, period } })
  const overrides = {
    weekly_connected_members: weekly([
      { key: 'wcm', label: 'Connected members', values: n.wcm, primary: true },
      { key: 'avg', label: '4-week average', values: n.avg },
      { key: 'share', label: 'Share of members connected', values: n.share, unit: 'percent' }
    ]),
    weekly_active_contributors: weekly([{ key: 'n', label: 'Contributors', values: n.wac, primary: true }]),
    quiet_signal: { data: { granularity: 'week', x, lines: [{ key: 'q', label: 'Quiet', values: [null, null, null, null], primary: true }], partialLast: true }, headline: null },
    group_links: kpi(n.links[0][1] + n.links[1][1], 'last 30 days', { breakdown: n.links.map(([label, value]) => ({ label, value, unit: 'count' })) }),
    unsubscribe_all_leak: kpi(n.leak, 'trailing 30 days')
  }
  if (which === 'earlier') {
    overrides.weekly_connected_members.headline = { value: n.wcm[1], previous: n.wcm[0], period: x[1] }
    overrides.signup_joined_group_7d = kpi(n.joined, null)
    overrides.join_request_decision_time = kpi(n.decisionHours, null)
  }
  return {
    ...fixture,
    asOf: asOf.length === 10 ? `${asOf}T00:00:00.000Z` : asOf,
    sections: [...fixture.sections, { id: 'extra', title: 'Extra', question: null, metrics: extraMetrics }].map(section => ({
      ...section,
      metrics: section.metrics
        .filter(metric => which === 'now' || metric.id !== 'live_groups_linked')
        .map(metric => (overrides[metric.id] ? { ...metric, ...overrides[metric.id] } : metric))
    }))
  }
}

const asOfParam = url => new URL(url, 'http://localhost').searchParams.get('asOf')
const earlierFor = url => jsonResponse(200, buildPanel(asOfParam(url), 'earlier'))

// Answers each request by its asOf ('today' when there is none), falling back to `default`
function fetchByDate (responders) {
  return jest.fn(url => {
    const respond = responders[asOfParam(url) || 'today'] || responders.default
    return respond(url)
  })
}

const comparisonUrls = () => urls().filter(url => /asOf=2025-/.test(url))
const mainUrls = () => urls().filter(url => !url.includes('asOf'))
const lockName = date => `${date}T00:00:00.000Z`

// Mirrors the server's cache and lock: one computation at a time, cached results and errors served unless
// refresh=1, and a refresh only taking effect once it gets the lock. finish() completes the running one.
function fakeServer (cached) {
  const results = new Map(Object.entries(cached))
  const computed = []
  let holder = null
  const fetch = jest.fn(url => {
    const name = asOfParam(url) ? lockName(asOfParam(url)) : 'live'
    const refresh = new URL(url, 'http://localhost').searchParams.get('refresh') === '1'
    const hit = results.get(name)
    if (!refresh && hit) return hit.error ? jsonResponse(500, { status: 'error', error: hit.error }) : jsonResponse(200, hit)
    if (!holder) {
      holder = name
      computed.push(name)
      results.delete(name)
    }
    return jsonResponse(202, { status: 'computing', startedAt: new Date().toISOString(), busyWith: holder })
  })
  const finish = body => {
    results.set(holder, body)
    holder = null
  }
  return { fetch, computed, finish }
}

// Collects every text the DOM shows until stopped, including texts replaced again within the same act()
function recordTexts () {
  const texts = []
  const collect = records => records.forEach(record => {
    const nodes = record.type === 'characterData' ? [record.target] : Array.from(record.addedNodes)
    nodes.forEach(node => texts.push(node.textContent))
  })
  const observer = new window.MutationObserver(collect)
  observer.observe(document.body, { subtree: true, childList: true, characterData: true })
  return () => {
    collect(observer.takeRecords())
    observer.disconnect()
    return texts
  }
}

async function turnOnComparison () {
  await screen.findByTestId('north-star')
  fireEvent.click(screen.getByRole('switch', { name: 'Compare to historical data' }))
  return screen.findByTestId('comparison-status')
}

async function applyDate (date) {
  fireEvent.change(screen.getByLabelText('View a past date'), { target: { value: date } })
  fireEvent.click(screen.getByRole('button', { name: 'View date' }))
}

const advancePoll = () => act(async () => { jest.advanceTimersByTime(POLL_INTERVAL_MS) })

describe('PlatformHealth comparison', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.useRealTimers()
  })

  it('is off by default and loads only the current panel', async () => {
    global.fetch = jest.fn(() => jsonResponse(200, fixture))
    render(<PlatformHealth />)
    await screen.findByTestId('north-star')

    const toggle = screen.getByRole('switch', { name: 'Compare to historical data' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).toHaveAttribute('data-testid', 'compare-toggle')
    expect(screen.queryByTestId('compare-period')).not.toBeInTheDocument()
    expect(screen.queryByTestId('comparison-status')).not.toBeInTheDocument()
    expect(screen.queryByTestId('comparison-headline')).not.toBeInTheDocument()
    expect(screen.queryByTestId('comparison-line')).not.toBeInTheDocument()
    // The live region is already there, empty, so the first comparison message is announced
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(urls()).toEqual(['/noo/admin/platform-health'])
  })

  it('compares the date shown with 364 days earlier, or 182 days for six months', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-25T21:30:00.000Z') })
    global.fetch = fetchByDate({ today: () => jsonResponse(200, buildPanel('2026-09-25T21:00:00.000Z')), default: earlierFor })
    render(<PlatformHealth />)

    const status = await turnOnComparison()
    expect(screen.getByRole('switch', { name: 'Compare to historical data' })).toHaveAttribute('aria-checked', 'true')
    expect(status.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite')
    expect(await within(status).findByText('Compared with September 26, 2025 (52 weeks earlier)')).toBeInTheDocument()
    expect(urls()).toEqual(['/noo/admin/platform-health', '/noo/admin/platform-health?asOf=2025-09-26'])
    expect(screen.getByLabelText('Compare with')).toHaveValue('1y')

    const stopRecording = recordTexts()
    fireEvent.change(screen.getByLabelText('Compare with'), { target: { value: '6m' } })
    // The year-earlier numbers are never relabelled, and are gone before the six-month panel arrives
    expect(stopRecording().filter(text => text.includes('6 months earlier'))).toEqual([])
    expect(screen.queryAllByTestId('comparison-headline')).toHaveLength(0)
    expect(within(status).getByText('Loading the comparison with March 27, 2026…')).toBeInTheDocument()
    expect(await within(status).findByText('Compared with March 27, 2026 (26 weeks earlier)')).toBeInTheDocument()
    expect(urls()).toEqual(['/noo/admin/platform-health', '/noo/admin/platform-health?asOf=2025-09-26', '/noo/admin/platform-health?asOf=2026-03-27'])
    expect(within(screen.getByTestId('north-star')).getByTestId('comparison-headline')).toHaveTextContent('vs 6 months earlier · Week of Mar 16, 2026: 250')
  })

  it('keeps comparing with the date shown when the page stays open past midnight UTC', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-27T23:59:50.000Z') })
    global.fetch = fetchByDate({ today: () => jsonResponse(200, buildPanel('2026-09-27T23:50:00.000Z')), default: earlierFor })
    render(<PlatformHealth />)
    const status = await turnOnComparison()
    expect(await within(status).findByText('Compared with September 28, 2025 (52 weeks earlier)')).toBeInTheDocument()

    act(() => { jest.setSystemTime(new Date('2026-09-28T00:00:30.000Z')) })
    fireEvent.change(screen.getByLabelText('View a past date'), { target: { value: '2026-09-20' } })
    expect(within(status).getByText('Compared with September 28, 2025 (52 weeks earlier)')).toBeInTheDocument()
    expect(urls()).toEqual(['/noo/admin/platform-health', '/noo/admin/platform-health?asOf=2025-09-28'])
  })

  it('compares an applied past date with the same date a period earlier', async () => {
    global.fetch = fetchByDate({
      today: () => jsonResponse(200, buildPanel('2026-03-27')),
      '2026-03-24': () => jsonResponse(200, buildPanel('2026-03-24')),
      default: earlierFor
    })
    render(<PlatformHealth />)
    await screen.findByTestId('north-star')
    await applyDate('2026-03-24')
    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith('/noo/admin/platform-health?asOf=2026-03-24', fetchOptions))

    const status = await turnOnComparison()
    expect(await within(status).findByText('Compared with March 25, 2025 (52 weeks earlier)')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenLastCalledWith('/noo/admin/platform-health?asOf=2025-03-25', fetchOptions)
    // The current column holds the viewed date's values, so it is headed by that date rather than 'Now'
    const breakdown = within(screen.getByTestId('metric-card-group_links')).getByTestId('comparison-table')
    expect(within(breakdown).getByRole('columnheader', { name: 'Mar 24, 2026' })).toBeInTheDocument()
    expect(within(breakdown).queryByRole('columnheader', { name: 'Now' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Compare with'), { target: { value: '6m' } })
    expect(await within(status).findByText('Compared with September 23, 2025 (26 weeks earlier)')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenLastCalledWith('/noo/admin/platform-health?asOf=2025-09-23', fetchOptions)
  })

  it('draws the earlier period on charts, headlines, tiles and breakdowns', async () => {
    global.fetch = fetchByDate({ today: () => jsonResponse(200, buildPanel('2026-03-27')), default: earlierFor })
    render(<PlatformHealth />)
    const status = await turnOnComparison()
    await within(status).findByText(/^Compared with /)

    // The earlier panel's own headline is the week of Mar 10; the matching week is Mar 17
    const hero = screen.getByTestId('north-star')
    const heroComparison = within(hero).getByTestId('comparison-headline')
    expect(heroComparison).toHaveTextContent('vs 1 year earlier · Week of Mar 17, 2025: 250')
    expect(within(heroComparison).getByTestId('headline-change')).toHaveAttribute('data-tone', 'good')
    expect(within(heroComparison).getByTestId('headline-change')).toHaveTextContent('Up 1,131 from 250')
    expect(heroComparison.previousElementSibling).toHaveTextContent(/^Week of Mar 16, 2026$/)
    expect(within(hero).getByTestId('comparison-line')).toBeInTheDocument()
    // The y-axis grows to the earlier peak (1,500), above the current one (1,381)
    expect(within(within(hero).getByRole('img')).getByText('1,500')).toBeInTheDocument()

    const card = screen.getByTestId('metric-card-weekly_connected_members')
    expect(within(card).getByTestId('comparison-headline').previousElementSibling).toHaveTextContent(/^Week of Mar 16, 2026$/)
    const line = within(card).getByTestId('comparison-line')
    expect(line).toHaveAttribute('stroke-dasharray', '9 5')
    expect(line.parentNode).toHaveAttribute('stroke-opacity', '0.45')
    expect(within(card).getByRole('list', { name: 'Legend' })).toHaveTextContent('Connected members, 1 year earlier')
    const tooltips = Array.from(card.querySelectorAll('rect > title')).map(node => node.textContent)
    expect(tooltips[1]).toContain('Connected members, 1 year earlier: 1,500')
    expect(tooltips[2]).toBe('Mar 16, 2026\nConnected members: 1,381\nConnected members, 1 year earlier: 250\n4-week average: 500\n4-week average, 1 year earlier: 220')
    expect(tooltips[3]).not.toMatch(/1 year earlier/)
    expect(within(card).getByRole('img').getAttribute('aria-label')).toMatch(/ Connected members, 1 year earlier: 250 \(Mar 17, 2025\)\.$/)
    const offAxis = within(card).getByTestId('comparison-table')
    expect(within(offAxis).getByRole('rowheader', { name: 'Share of members connected' }).parentNode).toHaveTextContent('12.0%10.0%')

    const tile = screen.getByTestId('vital-tile-join_request_decision_time')
    const tileComparison = within(tile).getByTestId('comparison-headline')
    expect(tileComparison).toHaveAttribute('title', 'vs 1 year earlier: 30.0 hours')
    expect(within(tileComparison).getByTestId('headline-change')).toHaveAttribute('data-tone', 'good')
    expect(within(screen.getByTestId('vital-tile-signup_joined_group_7d')).getByTestId('comparison-headline')).toHaveTextContent('vs 1 year earlier')
    const seriesTile = screen.getByTestId('vital-tile-weekly_active_contributors')
    expect(within(seriesTile).getByTestId('comparison-line')).toBeInTheDocument()
    expect(within(seriesTile).getByTestId('comparison-headline')).toHaveTextContent('Up 10 from 35')
    expect(within(screen.getByTestId('vital-tile-quiet_signal')).queryByTestId('comparison-headline')).not.toBeInTheDocument()

    expect(within(screen.getByTestId('metric-card-live_groups_linked')).getByTestId('comparison-headline')).toHaveTextContent('1 year earlier: not available')
    // Built from notifications, which are deleted after a month: the earlier 0 is not a real reading
    expect(within(screen.getByTestId('metric-card-unsubscribe_all_leak')).getByTestId('comparison-headline')).toHaveTextContent('1 year earlier: not available')

    const breakdown = within(screen.getByTestId('metric-card-group_links')).getByTestId('comparison-table')
    expect(within(breakdown).getByRole('columnheader', { name: 'Now' })).toBeInTheDocument()
    expect(within(breakdown).getByRole('columnheader', { name: '1 year earlier' })).toBeInTheDocument()
    const earlierValues = within(breakdown).getAllByTestId('comparison-value')
    expect(earlierValues.map(node => node.textContent)).toEqual(['300', '1,000', '30', '—'])
    expect(earlierValues[2]).toHaveAttribute('title', 'New links, 2025-Q1')

    expect(within(screen.getByTestId('metric-card-moderation_health')).queryByTestId('comparison-value')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('metric-card-signup_contributed_30d')).queryByTestId('comparison-value')).not.toBeInTheDocument()
  })

  it('keeps the panel usable while the comparison waits and computes', async () => {
    jest.useFakeTimers()
    const startedAt = new Date().toISOString()
    let comparisonPolls = 0
    global.fetch = fetchByDate({
      today: () => jsonResponse(200, fixture),
      '2026-03-20': () => jsonResponse(200, fixture),
      default: url => jsonResponse(202, { status: 'computing', startedAt, busyWith: ++comparisonPolls === 1 ? 'live' : lockName(asOfParam(url)) })
    })
    render(<PlatformHealth />)
    const status = await turnOnComparison()

    // Behind another computation, whose start time says nothing about this one
    expect(await screen.findByText('Waiting for another computation to finish')).toBeInTheDocument()
    expect(screen.queryByText(/^Started \d+ s ago$/)).not.toBeInTheDocument()
    expect(status).toHaveTextContent(/^Loading the comparison with .+…$/)
    expect(screen.getByTestId('comparison-caveat')).toHaveTextContent("Earlier periods are recomputed from today's data, so posts and accounts deleted since then are left out. Point-in-time and notification-based numbers, such as DAU, WAU and MAU, can't be rebuilt for past dates and show as not available.")
    expect(screen.queryByTestId('computing-state')).not.toBeInTheDocument()
    expect(screen.queryByTestId('comparison-headline')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
    expect(screen.getByTestId('north-star').closest('[aria-busy]')).toHaveAttribute('aria-busy', 'false')

    await advancePoll()
    expect(comparisonUrls()).toHaveLength(2)
    const elapsed = await screen.findByText(/^Started \d+ s ago$/)
    // The ticking counter stays out of the live region, so it isn't announced every second
    expect(elapsed.closest('[aria-live]')).toBeNull()
    expect(screen.queryByText('Waiting for another computation to finish')).not.toBeInTheDocument()

    await applyDate('2026-03-20')
    expect(await screen.findByTestId('north-star')).toBeInTheDocument()
    expect(urls()).toContain('/noo/admin/platform-health?asOf=2026-03-20')
    expect(screen.getByTestId('comparison-status')).toHaveTextContent(/^Loading the comparison with /)
  })

  it('shows a comparison error with a Retry that refreshes only the comparison', async () => {
    let failures = 1
    global.fetch = fetchByDate({
      today: () => jsonResponse(200, fixture),
      default: url => (failures-- > 0 ? jsonResponse(500, { status: 'error', error: 'statement timeout' }) : earlierFor(url))
    })
    render(<PlatformHealth />)
    const status = await turnOnComparison()

    expect(await within(status).findByText('The comparison could not be loaded: statement timeout')).toBeInTheDocument()
    expect(screen.queryByTestId('panel-error')).not.toBeInTheDocument()
    expect(screen.getByTestId('north-star')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await within(status).findByText(/^Compared with /)).toBeInTheDocument()
    const [first, retry] = comparisonUrls()
    expect(comparisonUrls()).toHaveLength(2)
    expect(retry).toBe(`${first}&refresh=1`)
    expect(urls().filter(url => url.includes('refresh'))).toEqual([retry])
  })

  it('repeats Refresh until the server starts it, while the comparison holds the computation', async () => {
    jest.useFakeTimers()
    const comparison = lockName('2025-03-28')
    const server = fakeServer({ live: fixture })
    global.fetch = server.fetch
    render(<PlatformHealth />)
    await turnOnComparison()
    expect(server.computed).toEqual([comparison])

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByTestId('computing-state')).toHaveTextContent('Waiting for another computation to finish')
    await advancePoll()
    expect(mainUrls()).toEqual(['/noo/admin/platform-health', '/noo/admin/platform-health?refresh=1', '/noo/admin/platform-health?refresh=1'])

    server.finish(buildPanel('2025-03-28', 'earlier'))
    await advancePoll()
    expect(server.computed).toEqual([comparison, 'live'])
    expect(await within(screen.getByTestId('comparison-status')).findByText(/^Compared with /)).toBeInTheDocument()

    // Once its own run has started, polling no longer asks for another one
    await advancePoll()
    expect(mainUrls().slice(3)).toEqual(['/noo/admin/platform-health?refresh=1', '/noo/admin/platform-health'])
    expect(screen.getByTestId('computing-state')).toHaveTextContent(/Started \d+ s ago/)

    server.finish({ ...fixture, cached: false, northStar: { ...fixture.northStar, name: 'Recomputed north star' } })
    await advancePoll()
    expect(await screen.findByTestId('north-star')).toHaveTextContent('Recomputed north star')
    expect(server.computed).toEqual([comparison, 'live'])
    expect(screen.queryByTestId('cached-badge')).not.toBeInTheDocument()
  })

  it('repeats the comparison Retry until the server starts it, while the current panel computes', async () => {
    jest.useFakeTimers()
    const comparison = lockName('2025-03-28')
    const server = fakeServer({ live: fixture, [comparison]: { error: 'statement timeout' } })
    global.fetch = server.fetch
    render(<PlatformHealth />)
    const status = await turnOnComparison()
    expect(await within(status).findByText('The comparison could not be loaded: statement timeout')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByTestId('computing-state')).toBeInTheDocument()
    expect(server.computed).toEqual(['live'])

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Waiting for another computation to finish')).toBeInTheDocument()
    await advancePoll()
    server.finish(fixture)
    await advancePoll()
    expect(server.computed).toEqual(['live', comparison])
    await advancePoll()
    server.finish(buildPanel('2025-03-28', 'earlier'))
    await advancePoll()
    expect(await within(status).findByText(/^Compared with /)).toBeInTheDocument()
    expect(comparisonUrls()).toEqual([
      '/noo/admin/platform-health?asOf=2025-03-28',
      '/noo/admin/platform-health?asOf=2025-03-28&refresh=1',
      '/noo/admin/platform-health?asOf=2025-03-28&refresh=1',
      '/noo/admin/platform-health?asOf=2025-03-28&refresh=1',
      '/noo/admin/platform-health?asOf=2025-03-28',
      '/noo/admin/platform-health?asOf=2025-03-28'
    ])
  })

  it('refreshes only the current panel from Refresh', async () => {
    global.fetch = fetchByDate({ today: () => jsonResponse(200, fixture), default: earlierFor })
    render(<PlatformHealth />)
    const status = await turnOnComparison()
    await within(status).findByText(/^Compared with /)
    const [comparisonUrl] = comparisonUrls()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled())
    expect(urls()).toEqual(['/noo/admin/platform-health', comparisonUrl, '/noo/admin/platform-health?refresh=1'])
    expect(within(screen.getByTestId('north-star')).getByTestId('comparison-headline')).toBeInTheDocument()
  })

  it('removes every overlay when turned off', async () => {
    global.fetch = fetchByDate({ today: () => jsonResponse(200, buildPanel('2026-03-27')), default: earlierFor })
    render(<PlatformHealth />)
    const status = await turnOnComparison()
    await within(status).findByText(/^Compared with /)
    expect(screen.getAllByTestId('comparison-headline').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('switch', { name: 'Compare to historical data' }))
    for (const id of ['comparison-status', 'comparison-caveat', 'compare-period', 'comparison-headline', 'comparison-line', 'comparison-table', 'comparison-bar', 'comparison-marker']) {
      expect(screen.queryAllByTestId(id)).toHaveLength(0)
    }
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('stops polling the comparison when turned off', async () => {
    jest.useFakeTimers()
    const hanging = deferred()
    let polls = 0
    global.fetch = fetchByDate({
      today: () => jsonResponse(200, fixture),
      default: () => (++polls === 1 ? jsonResponse(202, { status: 'computing', startedAt: new Date().toISOString() }) : hanging.promise)
    })
    render(<PlatformHealth />)
    await turnOnComparison()
    expect(await screen.findByText(/^Started \d+ s ago$/)).toBeInTheDocument()

    await advancePoll()
    expect(comparisonUrls()).toHaveLength(2)
    const pollSignal = global.fetch.mock.calls[2][1].signal

    fireEvent.click(screen.getByRole('switch', { name: 'Compare to historical data' }))
    expect(pollSignal.aborted).toBe(true)
    expect(screen.queryByTestId('comparison-status')).not.toBeInTheDocument()

    await act(async () => { hanging.resolve({ status: 200, ok: true, json: () => Promise.resolve(buildPanel('2025-03-28', 'earlier')) }) })
    await act(async () => { jest.advanceTimersByTime(POLL_INTERVAL_MS * 3) })
    expect(global.fetch).toHaveBeenCalledTimes(3)
    expect(screen.queryAllByTestId('comparison-headline')).toHaveLength(0)
  })

  it('shows only the new comparison after a new date is applied', async () => {
    const pending = deferred()
    global.fetch = fetchByDate({
      today: () => jsonResponse(200, buildPanel('2026-03-27')),
      '2026-03-24': () => jsonResponse(200, buildPanel('2026-03-24')),
      '2025-03-25': () => pending.promise,
      default: earlierFor
    })
    render(<PlatformHealth />)
    const status = await turnOnComparison()
    await within(status).findByText(/^Compared with /)
    expect(within(screen.getByTestId('north-star')).getByTestId('comparison-headline')).toHaveTextContent(': 250')

    const stopRecording = recordTexts()
    await applyDate('2026-03-24')
    await waitFor(() => expect(urls()).toContain('/noo/admin/platform-health?asOf=2025-03-25'))
    expect(await screen.findByTestId('north-star')).toBeInTheDocument()
    expect(screen.getByTestId('comparison-status')).toHaveTextContent('Loading the comparison with March 25, 2025…')
    expect(stopRecording().filter(text => text.includes('vs 1 year earlier'))).toEqual([])

    const newer = buildPanel('2025-03-25', 'earlier')
    newer.sections = newer.sections.map(section => ({
      ...section,
      metrics: section.metrics.map(metric => (metric.id === 'weekly_connected_members'
        ? { ...metric, data: { ...metric.data, lines: metric.data.lines.map(l => (l.key === 'wcm' ? { ...l, values: [200, 1500, 500, 60] } : l)) } }
        : metric))
    }))
    await act(async () => { pending.resolve({ status: 200, ok: true, json: () => Promise.resolve(newer) }) })
    expect(await within(screen.getByTestId('comparison-status')).findByText('Compared with March 25, 2025 (52 weeks earlier)')).toBeInTheDocument()
    expect(within(screen.getByTestId('north-star')).getByTestId('comparison-headline')).toHaveTextContent('vs 1 year earlier · Week of Mar 17, 2025: 500')
  })
})

describe('platform health formatting', () => {
  it('formats values by unit', () => {
    expect(formatValue(0.534, 'percent')).toBe('53.4%')
    expect(formatValue(0, 'percent')).toBe('0.0%')
    expect(formatValue(12345, 'count')).toBe('12,345')
    expect(formatValue(3.14159, 'ratio')).toBe('3.14')
    expect(formatValue(4, 'days')).toBe('4.0 days')
    expect(formatValue(null, 'percent')).toBe('—')
    expect(formatValue(undefined, 'count')).toBe('—')
  })

  it('formats changes and their tone', () => {
    expect(formatChange(-0.021, 'percent')).toBe('2.1 pts')
    expect(changeTone(10, 12, 'down')).toEqual({ delta: -2, direction: 'down', tone: 'good' })
    expect(changeTone(10, 12, 'up').tone).toBe('bad')
    expect(changeTone(10, 12, 'neutral').tone).toBe('neutral')
    expect(changeTone(10, null, 'up')).toBeNull()
  })

  it('formats series points by what x means', () => {
    const weekly = { granularity: 'week' }
    const windowed = { granularity: 'week', xMeaning: 'window-end', windowDays: 28 }
    expect(formatPoint('2026-03-22', weekly)).toBe('Mar 22, 2026')
    expect(formatPoint('2026-03-01', { granularity: 'month' })).toBe('Mar 2026')
    expect(formatPoint('2026-03-22', windowed)).toBe('to Mar 22, 2026')
    expect(formatPoint('2026-03-22', windowed, { withWindow: true })).toBe('28 days to Mar 22, 2026')
    expect(formatPoint('2026-03-22', { xMeaning: 'window-end' }, { withWindow: true })).toBe('to Mar 22, 2026')
  })

  it('treats only whole dates as dates', () => {
    expect(isStrictIsoDate('2026-03-27')).toBe(true)
    expect(isStrictIsoDate('2026-03-27T00:00:00.000Z')).toBe(true)
    expect(isStrictIsoDate('2026-03-01 to 2026-03-27')).toBe(false)
    expect(isStrictIsoDate('last 30 days')).toBe(false)
  })

  it('builds the endpoint url', () => {
    expect(platformHealthUrl('', false)).toBe('/noo/admin/platform-health')
    expect(platformHealthUrl('2026-03-27', true)).toBe('/noo/admin/platform-health?asOf=2026-03-27&refresh=1')
    // asOf is sent only as a plain date
    expect(platformHealthUrl('2026-03-27T00:00:00.000Z', false)).toBe('/noo/admin/platform-health')
  })
})
