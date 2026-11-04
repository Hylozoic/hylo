import React from 'react'
import { delay, graphql, HttpResponse } from 'msw'
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

const PAYMENT = { id: 'ch_1', amount: 1000, amountRefunded: 0, currency: 'usd', status: 'succeeded', paid: true, refunded: false, disputed: false, disputeStatus: null, refundBlock: null, subscriptionId: 'sub_1', description: 'Subscription creation', createdAt: '2026-11-01T00:00:00.000Z' }

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
        case 'HyloProPayments': return HttpResponse.json({ data: { hyloProPayments: { hasMore: false, items: [PAYMENT] } } })
        case 'HyloProGroups': return HttpResponse.json({ data: { hyloProGroups: [{ id: '12', name: 'New Group', slug: 'new-group', type: null }] } })
        case 'GrantHyloPro': return HttpResponse.json({ data: { grantHyloPro: row({ id: '3', source: 'manual', group: { id: '12', name: 'New Group', slug: 'new-group' } }) } })
        case 'ExtendHyloProSubscription': return HttpResponse.json({ data: { extendHyloProSubscription: row({ status: 'trialing' }) } })
        case 'CancelHyloProSubscription': return HttpResponse.json({ data: { cancelHyloProSubscription: row({ cancelAtPeriodEnd: true }) } })
        case 'RefundHyloProPayment': return HttpResponse.json({ data: { refundHyloProPayment: { id: 're_1', amount: 400, currency: 'usd', status: 'succeeded', subscriptionCanceled: !!variables.cancelSubscriptionId, cancelError: null } } })
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

  it('ignores a slow response for an earlier filter that arrives after the current one', async () => {
    mockApi({
      HyloProSubscriptions: async ({ filter }) => {
        // The first list (active) is slow; the grants list answers at once
        if (filter === 'active') await delay(300)
        const items = filter === 'active' ? [ROWS[0]] : [ROWS[1]]
        return HttpResponse.json({ data: { hyloProSubscriptions: { total: 1, hasMore: false, items } } })
      }
    })
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Grants' }))

    await findRow('Partner Group')
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(screen.queryByText('Paying Group')).not.toBeInTheDocument()
    expect(screen.getByText('Partner Group')).toBeInTheDocument()
  })

  it('finds the group first, then grants Pro to it by id with an end date and note, then reloads', async () => {
    const requests = mockApi()
    const { container } = renderPage()
    await findRow('Paying Group')

    const form = screen.getByTestId('hylo-pro-grant-form')
    fireEvent.change(within(form).getByPlaceholderText('my-group'), { target: { value: ' new-group ' } })
    fireEvent.change(container.querySelector('[data-testid="hylo-pro-grant-form"] input[type="date"]'), { target: { value: '2027-03-31' } })
    fireEvent.change(within(form).getByLabelText('Note (why it was granted)'), { target: { value: 'Pilot' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Find group' }))

    const matches = await within(form).findByTestId('hylo-pro-grant-matches')
    expect(requests.HyloProGroups).toEqual([{ slugOrId: 'new-group' }])
    expect(within(matches).getByText('Slug new-group · ID 12')).toBeInTheDocument()
    expect(requests.GrantHyloPro).toBeUndefined()
    fireEvent.click(within(matches).getByRole('button', { name: 'Grant Pro to New Group' }))

    await waitFor(() => expect(requests.GrantHyloPro).toHaveLength(1))
    const variables = requests.GrantHyloPro[0]
    expect(variables).toMatchObject({ groupId: '12', note: 'Pilot' })
    expect(new Date(variables.expiresAt).getTime()).toBe(new Date('2027-03-31T23:59:59').getTime())
    await waitFor(() => expect(requests.HyloProMetrics.length).toBe(2))
  })

  it('shows both groups when an all-digit value matches one group by slug and another by id, and grants the one chosen', async () => {
    const requests = mockApi({
      HyloProGroups: () => HttpResponse.json({ data: { hyloProGroups: [{ id: '57', name: 'Class of 2024', slug: '2024', type: null }, { id: '2024', name: 'Other Group', slug: 'other', type: null }] } })
    })
    renderPage()
    await findRow('Paying Group')

    const form = screen.getByTestId('hylo-pro-grant-form')
    fireEvent.change(within(form).getByPlaceholderText('my-group'), { target: { value: '2024' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Find group' }))

    const matches = await within(form).findByTestId('hylo-pro-grant-matches')
    expect(within(matches).getByText('"2024" matches more than one group. Choose the one you mean:')).toBeInTheDocument()
    fireEvent.click(within(matches).getByRole('button', { name: 'Grant Pro to Other Group' }))
    await waitFor(() => expect(requests.GrantHyloPro).toEqual([expect.objectContaining({ groupId: '2024' })]))
  })

  it('says when no group matches, and offers no grant for a space', async () => {
    mockApi({ HyloProGroups: ({ slugOrId }) => HttpResponse.json({ data: { hyloProGroups: slugOrId === 'a-space' ? [{ id: '5', name: 'A Space', slug: 'a-space', type: 'space' }] : [] } }) })
    renderPage()
    await findRow('Paying Group')
    const form = screen.getByTestId('hylo-pro-grant-form')

    fireEvent.change(within(form).getByPlaceholderText('my-group'), { target: { value: 'nope' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Find group' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No group found for "nope"'))

    fireEvent.change(within(form).getByPlaceholderText('my-group'), { target: { value: 'a-space' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Find group' }))
    expect(await within(form).findByText("Spaces can't have Hylo Pro")).toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: /Grant Pro to/ })).not.toBeInTheDocument()
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

    await waitFor(() => expect(requests.RefundHyloProPayment).toEqual([{ groupId: '10', chargeId: 'ch_1', amount: 400, cancelSubscriptionId: null }]))
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('This does not cancel the subscription'))
  })

  it('refunds and also cancels the subscription now when the box is ticked', async () => {
    const requests = mockApi()
    renderPage()
    const sub = await findRow('Paying Group')

    fireEvent.click(within(sub).getByRole('button', { name: 'Payments' }))
    const payments = await within(sub).findByTestId('hylo-pro-payments')
    fireEvent.click(within(payments).getByLabelText('Also cancel the subscription now (after the refund)'))
    fireEvent.click(within(payments).getByRole('button', { name: 'Refund' }))

    await waitFor(() => expect(requests.RefundHyloProPayment).toEqual([{ groupId: '10', chargeId: 'ch_1', amount: null, cancelSubscriptionId: '1' }]))
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('cancel the subscription now? Pro stops immediately.'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Refunded $10.00 and cancelled the subscription'))
  })

  it('says clearly when the refund worked but the cancellation failed', async () => {
    mockApi({
      RefundHyloProPayment: () => HttpResponse.json({ data: { refundHyloProPayment: { id: 're_1', amount: 1000, currency: 'usd', status: 'succeeded', subscriptionCanceled: false, cancelError: 'Stripe is down' } } })
    })
    renderPage()
    const sub = await findRow('Paying Group')

    fireEvent.click(within(sub).getByRole('button', { name: 'Payments' }))
    const payments = await within(sub).findByTestId('hylo-pro-payments')
    fireEvent.click(within(payments).getByLabelText('Also cancel the subscription now (after the refund)'))
    fireEvent.click(within(payments).getByRole('button', { name: 'Refund' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Refunded $10.00, but cancelling the subscription failed: Stripe is down. Use Cancel now to try again.'))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('marks disputed payments with their status and offers no refund for them', async () => {
    mockApi({
      HyloProPayments: () => HttpResponse.json({ data: { hyloProPayments: { hasMore: false, items: [{ ...PAYMENT, id: 'ch_d', description: 'Renewal', disputed: true, disputeStatus: 'needs_response', refundBlock: 'dispute_open' }, PAYMENT] } } })
    })
    renderPage()
    const sub = await findRow('Paying Group')

    fireEvent.click(within(sub).getByRole('button', { name: 'Payments' }))
    await within(sub).findByTestId('hylo-pro-payments')
    const [disputed, normal] = within(sub).getAllByTestId('hylo-pro-payment')
    expect(within(disputed).getByTestId('hylo-pro-disputed')).toHaveTextContent('Disputed: Needs response')
    expect(within(disputed).queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument()
    expect(within(disputed).getByText('Handle in Stripe')).toBeInTheDocument()
    expect(within(normal).queryByTestId('hylo-pro-disputed')).not.toBeInTheDocument()
    expect(within(normal).getByRole('button', { name: 'Refund' })).toBeInTheDocument()
  })

  it('offers refunds on inquiries and won disputes, keeping the marker, and explains lost ones', async () => {
    mockApi({
      HyloProPayments: () => HttpResponse.json({
        data: {
          hyloProPayments: {
            hasMore: false,
            items: [
              { ...PAYMENT, id: 'ch_inquiry', disputed: true, disputeStatus: 'warning_closed', refundBlock: null },
              { ...PAYMENT, id: 'ch_won', disputed: true, disputeStatus: 'won', refundBlock: null },
              { ...PAYMENT, id: 'ch_lost', disputed: true, disputeStatus: 'lost', refundBlock: 'dispute_lost' }
            ]
          }
        }
      })
    })
    renderPage()
    const sub = await findRow('Paying Group')

    fireEvent.click(within(sub).getByRole('button', { name: 'Payments' }))
    await within(sub).findByTestId('hylo-pro-payments')
    const [inquiry, won, lost] = within(sub).getAllByTestId('hylo-pro-payment')
    expect(within(inquiry).getByTestId('hylo-pro-disputed')).toHaveTextContent('Disputed: Closed')
    expect(within(inquiry).getByRole('button', { name: 'Refund' })).toBeInTheDocument()
    expect(within(won).getByTestId('hylo-pro-disputed')).toHaveTextContent('Disputed: Won')
    expect(within(won).getByRole('button', { name: 'Refund' })).toBeInTheDocument()
    expect(within(won).queryByText('Handle in Stripe')).not.toBeInTheDocument()
    expect(within(lost).getByTestId('hylo-pro-disputed')).toHaveTextContent('Disputed: Lost')
    expect(within(lost).queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument()
    expect(within(lost).getByText('Dispute lost: already returned to the customer')).toBeInTheDocument()
  })

  it("offers to cancel the subscription only on payments for this row's subscription", async () => {
    mockApi({
      HyloProPayments: () => HttpResponse.json({
        data: {
          hyloProPayments: {
            hasMore: false,
            items: [
              PAYMENT,
              { ...PAYMENT, id: 'ch_old', description: 'Earlier subscription', subscriptionId: 'sub_old' },
              { ...PAYMENT, id: 'ch_none', description: 'Not a subscription', subscriptionId: null }
            ]
          }
        }
      })
    })
    renderPage()
    const sub = await findRow('Paying Group')

    fireEvent.click(within(sub).getByRole('button', { name: 'Payments' }))
    await within(sub).findByTestId('hylo-pro-payments')
    const [mine, old, none] = within(sub).getAllByTestId('hylo-pro-payment')
    expect(within(mine).getByTestId('hylo-pro-refund-cancel')).toBeInTheDocument()
    expect(within(old).queryByTestId('hylo-pro-refund-cancel')).not.toBeInTheDocument()
    expect(within(none).queryByTestId('hylo-pro-refund-cancel')).not.toBeInTheDocument()
    expect(within(old).getByRole('button', { name: 'Refund' })).toBeInTheDocument()
  })

  it('keeps payments loaded with "Load more" after a refund, updating the refunded one', async () => {
    const requests = mockApi({
      HyloProPayments: ({ after }) => HttpResponse.json({
        data: { hyloProPayments: after ? { hasMore: false, items: [{ ...PAYMENT, id: 'ch_old', description: 'Older payment' }] } : { hasMore: true, items: [PAYMENT] } }
      })
    })
    renderPage()
    const sub = await findRow('Paying Group')

    fireEvent.click(within(sub).getByRole('button', { name: 'Payments' }))
    const payments = await within(sub).findByTestId('hylo-pro-payments')
    fireEvent.click(within(payments).getByRole('button', { name: 'Load more' }))
    const older = (await within(payments).findByText('Older payment')).closest('[data-testid="hylo-pro-payment"]')

    fireEvent.change(within(older).getByLabelText('Amount to refund'), { target: { value: '4' } })
    fireEvent.click(within(older).getByRole('button', { name: 'Refund' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Refunded $4.00'))
    await waitFor(() => expect(within(older).getByText('$4.00')).toBeInTheDocument())
    expect(within(payments).getByText('Subscription creation')).toBeInTheDocument()
    expect(within(payments).getByText('Older payment')).toBeInTheDocument()
    expect(requests.HyloProPayments.map(v => v.after)).toEqual([null, 'ch_1'])
  })

  it('shows an error, not an empty list, when the list fails to load', async () => {
    mockApi({
      HyloProSubscriptions: ({ filter }) => filter === 'past_due'
        ? HttpResponse.json({ errors: [{ message: 'Database unavailable' }] })
        : HttpResponse.json({ data: { hyloProSubscriptions: { total: ROWS.length, hasMore: false, items: ROWS } } })
    })
    renderPage()
    await findRow('Paying Group')

    fireEvent.click(screen.getByRole('tab', { name: 'Payment failed' }))
    expect(await screen.findByTestId('hylo-pro-rows-error')).toHaveTextContent('Database unavailable')
    expect(screen.queryByText('Nothing here.')).not.toBeInTheDocument()
    expect(screen.queryByText('Paying Group')).not.toBeInTheDocument()
  })

  it('loads more payments after the last one shown', async () => {
    const requests = mockApi({
      HyloProPayments: ({ after }) => HttpResponse.json({
        data: { hyloProPayments: after ? { hasMore: false, items: [{ ...PAYMENT, id: 'ch_old', description: 'Older payment' }] } : { hasMore: true, items: [PAYMENT] } }
      })
    })
    renderPage()
    const sub = await findRow('Paying Group')

    fireEvent.click(within(sub).getByRole('button', { name: 'Payments' }))
    const payments = await within(sub).findByTestId('hylo-pro-payments')
    fireEvent.click(within(payments).getByRole('button', { name: 'Load more' }))

    expect(await within(payments).findByText('Older payment')).toBeInTheDocument()
    expect(within(payments).getByText('Subscription creation')).toBeInTheDocument()
    expect(requests.HyloProPayments.map(v => v.after)).toEqual([null, 'ch_1'])
    expect(within(payments).queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
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

  it("explains Stripe's trial limit with the days left, from the error's code", async () => {
    mockApi({
      ExtendHyloProSubscription: () => HttpResponse.json({ errors: [{ message: 'server text', extensions: { code: 'HYLO_PRO_EXTEND_LIMIT', maxDays: 12, maxTrialDays: 730 } }] })
    })
    renderPage()
    const sub = await findRow('Paying Group')

    fireEvent.click(within(sub).getByRole('button', { name: 'Extend' }))
    fireEvent.click(within(sub).getAllByRole('button', { name: 'Extend' })[1])

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Stripe allows free time up to 730 days from today, so this subscription can be extended by at most 12 more days.'))
  })
})
