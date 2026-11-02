import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import BillingTab from './BillingTab'

const group = { id: '1', slug: 'hylo', name: 'Hylo' }

// Responds to the Billing tab's GraphQL operations; records mutation variables by operation name
function mockBillingApi ({ proSubscription = null, checkout, portal } = {}) {
  const requests = {}
  mockGraphqlServer.use(
    graphql.operation(({ operationName, variables }) => {
      requests[operationName] = (requests[operationName] || []).concat([variables])
      if (operationName === 'HyloProSubscriptionQuery') {
        return HttpResponse.json({ data: { group: { id: group.id, hasPro: !!proSubscription?.active, proSubscription } } })
      }
      if (operationName === 'CreateHyloProCheckoutSession') {
        return checkout ? checkout(variables) : HttpResponse.json({ data: { createHyloProCheckoutSession: { url: 'https://checkout.stripe.com/c/pay/cs_test' } } })
      }
      if (operationName === 'CreateHyloProPortalSession') {
        return portal ? portal(variables) : HttpResponse.json({ data: { createHyloProPortalSession: { url: 'https://billing.stripe.com/p/session/test' } } })
      }
      return HttpResponse.json({ data: {} })
    })
  )
  return requests
}

function renderTab (initialEntry = '/groups/hylo/settings/billing') {
  return render(<BillingTab group={group} />, { wrapper: AllTheProviders({}, [initialEntry]) })
}

describe('BillingTab', () => {
  let originalLocation

  beforeEach(() => {
    // Redirecting to Stripe sets window.location.href, which jsdom can't navigate
    originalLocation = window.location
    delete window.location
    window.location = { ...originalLocation, href: originalLocation.href }
  })

  afterEach(() => {
    window.location = originalLocation
  })

  it('offers monthly and yearly upgrades to a group without Pro, and sends the steward to Checkout', async () => {
    const requests = mockBillingApi()
    renderTab()

    expect(await screen.findByTestId('billing-plan-name')).toHaveTextContent('Free')
    expect(screen.getByTestId('billing-upgrade-month')).toHaveTextContent('$10/month')
    expect(screen.getByTestId('billing-upgrade-year')).toHaveTextContent('$100/year')
    expect(screen.queryByTestId('billing-manage')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('billing-upgrade-year'))

    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/c/pay/cs_test'))
    expect(requests.CreateHyloProCheckoutSession).toEqual([{ groupId: '1', interval: 'year' }])
  })

  it('shows a renewing yearly subscription with a Manage button that opens the portal', async () => {
    const requests = mockBillingApi({
      proSubscription: { id: '5', source: 'stripe', status: 'active', active: true, interval: 'year', currentPeriodEnd: '2027-03-01T12:00:00.000Z', cancelAtPeriodEnd: false, endsAt: null, endedAt: null }
    })
    renderTab()

    expect(await screen.findByTestId('billing-plan-name')).toHaveTextContent('Hylo Pro (yearly)')
    expect(screen.getByTestId('billing-plan-detail')).toHaveTextContent(/^Renews on .*2027/)
    expect(screen.queryByTestId('billing-upgrade-month')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('billing-manage'))

    await waitFor(() => expect(window.location.href).toBe('https://billing.stripe.com/p/session/test'))
    expect(requests.CreateHyloProPortalSession).toEqual([{ groupId: '1' }])
  })

  it('shows when a cancelled subscription ends', async () => {
    mockBillingApi({
      proSubscription: { id: '5', source: 'stripe', status: 'active', active: true, interval: 'month', currentPeriodEnd: '2027-03-01T12:00:00.000Z', cancelAtPeriodEnd: true, endsAt: '2027-03-01T12:00:00.000Z', endedAt: null }
    })
    renderTab()

    expect(await screen.findByTestId('billing-plan-name')).toHaveTextContent('Hylo Pro (monthly)')
    expect(screen.getByTestId('billing-plan-detail')).toHaveTextContent(/^Cancels on .*2027\. Pro features stay on until then\.$/)
    expect(screen.getByTestId('billing-manage')).toBeInTheDocument()
  })

  it('asks for a new card when a payment failed, instead of offering a second subscription', async () => {
    mockBillingApi({
      proSubscription: { id: '5', source: 'stripe', status: 'past_due', active: false, interval: 'month', currentPeriodEnd: '2027-03-01T12:00:00.000Z', cancelAtPeriodEnd: false, endsAt: null, endedAt: null }
    })
    renderTab()

    expect(await screen.findByTestId('billing-payment-failed')).toBeInTheDocument()
    expect(screen.getByTestId('billing-manage')).toBeInTheDocument()
    expect(screen.queryByTestId('billing-upgrade-month')).not.toBeInTheDocument()
  })

  it('shows a grant from Hylo without Stripe controls', async () => {
    mockBillingApi({
      proSubscription: { id: '6', source: 'manual', status: 'active', active: true, interval: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, endsAt: null, endedAt: null }
    })
    renderTab()

    expect(await screen.findByTestId('billing-plan-name')).toHaveTextContent('Hylo Pro (granted by Hylo)')
    expect(screen.getByTestId('billing-plan-detail')).toHaveTextContent('No end date')
    expect(screen.queryByTestId('billing-manage')).not.toBeInTheDocument()
    expect(screen.queryByTestId('billing-upgrade-month')).not.toBeInTheDocument()
  })

  it('lets a lapsed subscriber upgrade again and still reach their invoices', async () => {
    mockBillingApi({
      proSubscription: { id: '5', source: 'stripe', status: 'canceled', active: false, interval: 'month', currentPeriodEnd: '2026-03-01T12:00:00.000Z', cancelAtPeriodEnd: true, endsAt: '2026-03-01T12:00:00.000Z', endedAt: '2026-03-01T12:00:00.000Z' }
    })
    renderTab()

    expect(await screen.findByTestId('billing-plan-name')).toHaveTextContent('Free')
    expect(screen.getByTestId('billing-plan-detail')).toHaveTextContent(/^Your Hylo Pro subscription ended on .*2026\.$/)
    expect(screen.getByTestId('billing-upgrade-month')).toBeInTheDocument()
    expect(screen.getByTestId('billing-manage')).toBeInTheDocument()
  })

  it('shows an error and stays on the page when Checkout cannot be started', async () => {
    mockBillingApi({
      checkout: () => HttpResponse.json({ errors: [{ message: 'boom' }] })
    })
    const startHref = window.location.href
    renderTab()

    fireEvent.click(await screen.findByTestId('billing-upgrade-month'))

    expect(await screen.findByText('Oh no, something went wrong! Check your internet connection and try again')).toBeInTheDocument()
    expect(window.location.href).toBe(startHref)
    expect(screen.getByTestId('billing-upgrade-month')).not.toBeDisabled()
  })

  it('tells the steward when they cancel Checkout', async () => {
    mockBillingApi()
    renderTab('/groups/hylo/settings/billing?checkout=canceled')

    expect(await screen.findByTestId('billing-checkout-canceled')).toHaveTextContent('Checkout was canceled. You have not been charged.')
  })

  it('confirms the upgrade once the subscription is active after returning from Checkout', async () => {
    mockBillingApi({
      proSubscription: { id: '5', source: 'stripe', status: 'active', active: true, interval: 'month', currentPeriodEnd: '2027-03-01T12:00:00.000Z', cancelAtPeriodEnd: false, endsAt: null, endedAt: null }
    })
    renderTab('/groups/hylo/settings/billing?checkout=success')

    expect(await screen.findByTestId('billing-checkout-success')).toHaveTextContent('Thanks for upgrading to Hylo Pro!')
  })

  it('keeps checking for the subscription after returning from Checkout until the webhook lands', async () => {
    jest.useFakeTimers()
    try {
      let active = false
      mockGraphqlServer.use(
        graphql.operation(({ operationName }) => {
          if (operationName !== 'HyloProSubscriptionQuery') return HttpResponse.json({ data: {} })
          const proSubscription = active
            ? { id: '5', source: 'stripe', status: 'active', active: true, interval: 'month', currentPeriodEnd: '2027-03-01T12:00:00.000Z', cancelAtPeriodEnd: false, endsAt: null, endedAt: null }
            : null
          return HttpResponse.json({ data: { group: { id: group.id, hasPro: active, proSubscription } } })
        })
      )
      renderTab('/groups/hylo/settings/billing?checkout=success')

      expect(await screen.findByTestId('billing-checkout-success')).toHaveTextContent('will appear here in a moment')

      active = true
      jest.advanceTimersByTime(2000)

      expect(await screen.findByText('Thanks for upgrading to Hylo Pro!')).toBeInTheDocument()
      expect(screen.getByTestId('billing-plan-name')).toHaveTextContent('Hylo Pro (monthly)')
    } finally {
      jest.useRealTimers()
    }
  })
})
