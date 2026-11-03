import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, fireEvent, render, screen, waitFor, within } from 'util/testing/reactTestingLibraryExtended'
import { toast } from 'sonner'
import HyloPro from './HyloPro'

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const METRICS = {
  activeGroups: 3,
  stripeGroups: 2,
  manualGroups: 1,
  monthlySubscriptions: 1,
  yearlySubscriptions: 1,
  trialing: 0,
  cancelling: 1,
  pastDue: 1,
  grantsExpiringSoon: 0,
  mrrCents: 1833,
  currency: 'usd',
  months: [
    { month: '2026-10', newSubscriptions: 1, cancellations: 0, ended: 0, grants: 0 },
    { month: '2026-11', newSubscriptions: 4, cancellations: 1, ended: 0, grants: 2 }
  ]
}

const row = attrs => ({
  id: '1',
  source: 'stripe',
  status: 'active',
  active: true,
  interval: 'month',
  group: { id: '10', name: 'Paying Group', slug: 'paying' },
  grantedBy: null,
  note: null,
  expiresAt: null,
  stripeSubscriptionId: 'sub_1',
  stripeCustomerId: 'cus_1',
  currentPeriodEnd: '2027-01-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  endsAt: null,
  canceledAt: null,
  endedAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...attrs
})

const ROWS = [
  row(),
  row({ id: '2', source: 'manual', status: 'active', interval: null, group: { id: '11', name: 'Partner Group', slug: 'partner' }, grantedBy: { id: '7', name: 'Staff Person' }, note: 'Pilot partner', stripeSubscriptionId: null, stripeCustomerId: null, currentPeriodEnd: null, expiresAt: '2027-02-01T00:00:00.000Z', endsAt: '2027-02-01T00:00:00.000Z' })
]

// Responds to the page's GraphQL operations; records variables by operation name
function mockApi (overrides = {}) {
  const requests = {}
  mockGraphqlServer.use(
    graphql.operation(({ operationName, variables }) => {
      requests[operationName] = (requests[operationName] || []).concat([variables])
      if (overrides[operationName]) return overrides[operationName](variables)
      switch (operationName) {
        case 'HyloProMetrics': return HttpResponse.json({ data: { hyloProMetrics: METRICS } })
        case 'HyloProSubscriptions': return HttpResponse.json({ data: { hyloProSubscriptions: { total: ROWS.length, hasMore: false, items: ROWS } } })
        case 'HyloProPayments': return HttpResponse.json({ data: { hyloProPayments: [{ id: 'ch_1', amount: 1000, amountRefunded: 0, currency: 'usd', status: 'succeeded', paid: true, refunded: false, description: 'Subscription creation', createdAt: '2026-11-01T00:00:00.000Z' }] } })
        case 'GrantHyloPro': return HttpResponse.json({ data: { grantHyloPro: row({ id: '3', source: 'manual', group: { id: '12', name: 'New Group', slug: 'new-group' } }) } })
        case 'ExtendHyloProSubscription': return HttpResponse.json({ data: { extendHyloProSubscription: row({ status: 'trialing' }) } })
        case 'CancelHyloProSubscription': return HttpResponse.json({ data: { cancelHyloProSubscription: row({ cancelAtPeriodEnd: true }) } })
        case 'RefundHyloProPayment': return HttpResponse.json({ data: { refundHyloProPayment: { id: 're_1', amount: 400, currency: 'usd', status: 'succeeded' } } })
        default: return HttpResponse.json({ data: {} })
      }
    })
  )
  return requests
}

function renderPage () {
  return render(<HyloPro />, { wrapper: AllTheProviders({}, ['/management/paid-content/hylo-pro']) })
}

async function findRow (name) {
  const link = await screen.findByText(name)
  return link.closest('[data-testid="hylo-pro-row"]')
}

describe('HyloPro management page', () => {
  let confirmSpy

  beforeEach(() => {
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    toast.success.mockClear()
    toast.error.mockClear()
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  it('shows metrics and the active subscriptions and grants', async () => {
    const requests = mockApi()
    renderPage()

    const metrics = await screen.findByTestId('hylo-pro-metrics')
    expect(within(metrics).getByText('$18.33')).toBeInTheDocument()
    expect(within(metrics).getByText('3')).toBeInTheDocument()

    const grant = await findRow('Partner Group')
    expect(within(grant).getByText('Pilot partner')).toBeInTheDocument()
    expect(within(grant).getByText(/Granted by Staff Person/)).toBeInTheDocument()
    expect(within(grant).getByText('Revoke')).toBeInTheDocument()

    const sub = await findRow('Paying Group')
    expect(within(sub).getByText('Cancel at period end')).toBeInTheDocument()
    expect(within(sub).queryByText('Revoke')).not.toBeInTheDocument()
    expect(requests.HyloProSubscriptions[0]).toMatchObject({ filter: 'active' })
  })

  it('refetches with the chosen filter and search', async () => {
    const requests = mockApi()
    renderPage()
    await findRow('Paying Group')

    fireEvent.click(screen.getByRole('tab', { name: 'Payment failed' }))
    await waitFor(() => expect(requests.HyloProSubscriptions.at(-1)).toMatchObject({ filter: 'past_due' }))

    fireEvent.change(screen.getByLabelText('Search groups'), { target: { value: ' partner ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(requests.HyloProSubscriptions.at(-1)).toMatchObject({ filter: 'past_due', search: 'partner' }))
  })

  it('grants Pro with an end date and note, then reloads', async () => {
    const requests = mockApi()
    const { container } = renderPage()
    await findRow('Paying Group')

    const form = screen.getByTestId('hylo-pro-grant-form')
    fireEvent.change(within(form).getByPlaceholderText('my-group'), { target: { value: ' new-group ' } })
    fireEvent.change(container.querySelector('[data-testid="hylo-pro-grant-form"] input[type="date"]'), { target: { value: '2027-03-31' } })
    fireEvent.change(within(form).getByLabelText('Note (why it was granted)'), { target: { value: 'Pilot' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Grant Pro' }))

    await waitFor(() => expect(requests.GrantHyloPro).toHaveLength(1))
    const variables = requests.GrantHyloPro[0]
    expect(variables).toMatchObject({ groupId: 'new-group', note: 'Pilot' })
    expect(new Date(variables.expiresAt).getTime()).toBe(new Date('2027-03-31T23:59:59').getTime())
    await waitFor(() => expect(requests.HyloProMetrics.length).toBe(2))
  })

  it('extends a subscription by the chosen number of days', async () => {
    const requests = mockApi()
    renderPage()
    const sub = await findRow('Paying Group')

    fireEvent.click(within(sub).getByRole('button', { name: 'Extend' }))
    fireEvent.change(within(sub).getByLabelText('Days to add'), { target: { value: '14' } })
    fireEvent.click(within(sub).getAllByRole('button', { name: 'Extend' })[1])

    await waitFor(() => expect(requests.ExtendHyloProSubscription).toEqual([{ id: '1', days: 14 }]))
  })

  it('asks before cancelling, and does nothing when the confirmation is dismissed', async () => {
    const requests = mockApi()
    renderPage()
    const sub = await findRow('Paying Group')

    confirmSpy.mockReturnValueOnce(false)
    fireEvent.click(within(sub).getByRole('button', { name: 'Cancel now' }))
    expect(requests.CancelHyloProSubscription).toBeUndefined()

    fireEvent.click(within(sub).getByRole('button', { name: 'Cancel at period end' }))
    await waitFor(() => expect(requests.CancelHyloProSubscription).toEqual([{ id: '1', immediately: false }]))
  })

  it('lists payments and refunds part of one in cents', async () => {
    const requests = mockApi()
    renderPage()
    const sub = await findRow('Paying Group')

    fireEvent.click(within(sub).getByRole('button', { name: 'Payments' }))
    const payments = await within(sub).findByTestId('hylo-pro-payments')
    expect(within(payments).getByText('Subscription creation')).toBeInTheDocument()

    fireEvent.change(within(payments).getByLabelText('Amount to refund'), { target: { value: '4' } })
    fireEvent.click(within(payments).getByRole('button', { name: 'Refund' }))

    await waitFor(() => expect(requests.RefundHyloProPayment).toEqual([{ groupId: '10', chargeId: 'ch_1', amount: 400 }]))
  })

  it('shows the server error when an action is refused', async () => {
    mockApi({
      ExtendHyloProSubscription: () => HttpResponse.json({ errors: [{ message: 'Only an active or trialing subscription can be extended. Grant Pro instead.' }] })
    })
    renderPage()
    const sub = await findRow('Paying Group')

    fireEvent.click(within(sub).getByRole('button', { name: 'Extend' }))
    fireEvent.click(within(sub).getAllByRole('button', { name: 'Extend' })[1])

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Only an active or trialing subscription can be extended. Grant Pro instead.'))
  })
})
