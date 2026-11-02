import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { act, AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import BillingTab from './BillingTab'

const group = { id: '1', slug: 'hylo', name: 'Hylo' }

const PLANS = [
  { interval: 'month', unitAmount: 1000, currency: 'usd' },
  { interval: 'year', unitAmount: 10000, currency: 'usd' }
]

const OPEN_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']

// What the server's proBilling resolver returns for a Stripe subscription and/or grant
function billingFor ({ subscription = null, grant = null } = {}) {
  const hasPro = !!(subscription?.active || grant?.active)
  const open = !!subscription && OPEN_STATUSES.includes(subscription.status) && !subscription.endedAt
  return {
    hasPro,
    canUpgrade: !hasPro && !open,
    canManage: !!subscription,
    needsPaymentUpdate: open && ['past_due', 'unpaid', 'incomplete'].includes(subscription.status),
    subscription,
    grant,
    plans: PLANS
  }
}

const stripeSub = attrs => ({ id: '5', source: 'stripe', status: 'active', active: true, interval: 'month', currentPeriodEnd: '2027-03-01T12:00:00.000Z', cancelAtPeriodEnd: false, endsAt: null, endedAt: null, ...attrs })
const manualGrant = attrs => ({ id: '6', source: 'manual', status: 'active', active: true, interval: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, endsAt: null, endedAt: null, ...attrs })

// Responds to the Billing tab's GraphQL operations; records variables by operation name.
// `billing` may be a function, called on every query, for state that changes.
function mockBillingApi ({ billing = billingFor(), checkout, portal, activate } = {}) {
  const requests = {}
  mockGraphqlServer.use(
    graphql.operation(({ operationName, variables }) => {
      requests[operationName] = (requests[operationName] || []).concat([variables])
      if (operationName === 'HyloProBillingQuery') {
        const proBilling = typeof billing === 'function' ? billing() : billing
        return HttpResponse.json({ data: { group: { id: group.id, proBilling } } })
      }
      if (operationName === 'CreateHyloProCheckoutSession') {
        return checkout ? checkout(variables) : HttpResponse.json({ data: { createHyloProCheckoutSession: { url: 'https://checkout.stripe.com/c/pay/cs_test' } } })
      }
      if (operationName === 'CreateHyloProPortalSession') {
        return portal ? portal(variables) : HttpResponse.json({ data: { createHyloProPortalSession: { url: 'https://billing.stripe.com/p/session/test' } } })
      }
      if (operationName === 'ActivateHyloProCheckoutSession') {
        return activate ? activate(variables) : HttpResponse.json({ data: { activateHyloProCheckoutSession: { success: true, active: true } } })
      }
      return HttpResponse.json({ data: {} })
    })
  )
  return requests
}

// Shows the current query string, to check the checkout params are cleared (useLocation is mocked in Jest)
function LocationProbe () {
  const [searchParams] = useSearchParams()
  return <div data-testid='location'>{searchParams.toString()}</div>
}

function renderTab (initialEntry = '/groups/hylo/settings/billing') {
  return render(<><BillingTab group={group} /><LocationProbe /></>, { wrapper: AllTheProviders({}, [initialEntry]) })
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
    const requests = mockBillingApi({ billing: billingFor({ subscription: stripeSub({ interval: 'year' }) }) })
    renderTab()

    expect(await screen.findByTestId('billing-plan-name')).toHaveTextContent('Hylo Pro (yearly)')
    expect(screen.getByTestId('billing-plan-detail')).toHaveTextContent(/^Renews on .*2027/)
    expect(screen.queryByTestId('billing-upgrade-month')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('billing-manage'))

    await waitFor(() => expect(window.location.href).toBe('https://billing.stripe.com/p/session/test'))
    expect(requests.CreateHyloProPortalSession).toEqual([{ groupId: '1' }])
  })

  it('shows when a cancelled subscription ends', async () => {
    mockBillingApi({ billing: billingFor({ subscription: stripeSub({ cancelAtPeriodEnd: true, endsAt: '2027-03-01T12:00:00.000Z' }) }) })
    renderTab()

    expect(await screen.findByTestId('billing-plan-name')).toHaveTextContent('Hylo Pro (monthly)')
    expect(screen.getByTestId('billing-plan-detail')).toHaveTextContent(/^Cancels on .*2027\. Pro features stay on until then\.$/)
    expect(screen.getByTestId('billing-manage')).toBeInTheDocument()
  })

  it('asks for a new card when a payment failed, instead of offering a second subscription', async () => {
    mockBillingApi({ billing: billingFor({ subscription: stripeSub({ status: 'past_due', active: false }) }) })
    renderTab()

    expect(await screen.findByTestId('billing-payment-failed')).toBeInTheDocument()
    expect(screen.getByTestId('billing-manage')).toBeInTheDocument()
    expect(screen.queryByTestId('billing-upgrade-month')).not.toBeInTheDocument()
  })

  it('shows a grant from Hylo without Stripe controls', async () => {
    mockBillingApi({ billing: billingFor({ grant: manualGrant() }) })
    renderTab()

    expect(await screen.findByTestId('billing-plan-name')).toHaveTextContent('Hylo Pro (granted by Hylo)')
    expect(screen.getByTestId('billing-plan-detail')).toHaveTextContent('No end date')
    expect(screen.queryByTestId('billing-manage')).not.toBeInTheDocument()
    expect(screen.queryByTestId('billing-upgrade-month')).not.toBeInTheDocument()
  })

  it('lets a lapsed subscriber upgrade again and still reach their invoices', async () => {
    mockBillingApi({
      billing: billingFor({ subscription: stripeSub({ status: 'canceled', active: false, currentPeriodEnd: '2026-03-01T12:00:00.000Z', cancelAtPeriodEnd: true, endsAt: '2026-03-01T12:00:00.000Z', endedAt: '2026-03-01T12:00:00.000Z' }) })
    })
    renderTab()

    expect(await screen.findByTestId('billing-plan-name')).toHaveTextContent('Free')
    expect(screen.getByTestId('billing-plan-detail')).toHaveTextContent(/^Your Hylo Pro subscription ended on .*2026\.$/)
    expect(screen.getByTestId('billing-upgrade-month')).toBeInTheDocument()
    expect(screen.getByTestId('billing-manage')).toBeInTheDocument()
  })

  it('shows a connection error and stays on the page when Checkout cannot be reached', async () => {
    mockBillingApi({ checkout: () => HttpResponse.error() })
    const startHref = window.location.href
    renderTab()

    fireEvent.click(await screen.findByTestId('billing-upgrade-month'))

    expect(await screen.findByText('Oh no, something went wrong! Check your internet connection and try again')).toBeInTheDocument()
    expect(window.location.href).toBe(startHref)
    expect(screen.getByTestId('billing-upgrade-month')).not.toBeDisabled()
  })

  it("shows the server's message when it refuses to start Checkout", async () => {
    mockBillingApi({
      checkout: () => HttpResponse.json({ errors: [{ message: "You don't have permission to manage this group's billing", path: ['createHyloProCheckoutSession'] }] })
    })
    renderTab()

    fireEvent.click(await screen.findByTestId('billing-upgrade-month'))

    expect(await screen.findByTestId('billing-error')).toHaveTextContent("You don't have permission to manage this group's billing")
  })

  it('explains that the group already subscribed and shows that subscription to manage', async () => {
    let subscribedElsewhere = false
    mockBillingApi({
      billing: () => subscribedElsewhere ? billingFor({ subscription: stripeSub() }) : billingFor(),
      checkout: () => {
        // Another steward's subscription that reached the server after this page loaded
        subscribedElsewhere = true
        return HttpResponse.json({ errors: [{ message: 'This group already has a Hylo Pro subscription.', path: ['createHyloProCheckoutSession'], extensions: { code: 'HYLO_PRO_ALREADY_SUBSCRIBED' } }] })
      }
    })
    renderTab()

    fireEvent.click(await screen.findByTestId('billing-upgrade-year'))

    expect(await screen.findByTestId('billing-error')).toHaveTextContent('This group already has a Hylo Pro subscription. Use Manage subscription to change it.')
    expect(screen.getByTestId('billing-manage')).toBeInTheDocument()
    expect(screen.queryByTestId('billing-upgrade-year')).not.toBeInTheDocument()
  })

  it('re-enables the buttons when the browser restores the page after Back from Stripe', async () => {
    mockBillingApi()
    renderTab()

    fireEvent.click(await screen.findByTestId('billing-upgrade-month'))
    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/c/pay/cs_test'))
    expect(screen.getByTestId('billing-upgrade-month')).toBeDisabled()

    const pageshow = new Event('pageshow')
    pageshow.persisted = true
    act(() => { window.dispatchEvent(pageshow) })

    await waitFor(() => expect(screen.getByTestId('billing-upgrade-month')).not.toBeDisabled())
  })

  it('still shows a failing subscription and Manage while a grant from Hylo gives Pro', async () => {
    mockBillingApi({ billing: billingFor({ grant: manualGrant(), subscription: stripeSub({ status: 'past_due', active: false }) }) })
    renderTab()

    expect(await screen.findByTestId('billing-plan-name')).toHaveTextContent('Hylo Pro (granted by Hylo)')
    expect(screen.getByTestId('billing-payment-failed')).toBeInTheDocument()
    expect(screen.getByTestId('billing-manage')).toBeInTheDocument()
    expect(screen.queryByTestId('billing-upgrade-month')).not.toBeInTheDocument()
  })

  it('shows plan prices from the server', async () => {
    mockBillingApi({ billing: { ...billingFor(), plans: [{ interval: 'month', unitAmount: 1250, currency: 'usd' }] } })
    renderTab()

    expect(await screen.findByTestId('billing-upgrade-month')).toHaveTextContent('$12.50/month')
    expect(screen.queryByTestId('billing-upgrade-year')).not.toBeInTheDocument()
  })

  it('tells the steward when they cancel Checkout', async () => {
    mockBillingApi()
    renderTab('/groups/hylo/settings/billing?checkout=canceled')

    expect(await screen.findByTestId('billing-checkout-canceled')).toHaveTextContent('Checkout was canceled. You have not been charged.')
    // The params are cleared once handled, but the message stays
    await waitFor(() => expect(screen.getByTestId('location')).toBeEmptyDOMElement())
    expect(screen.getByTestId('billing-checkout-canceled')).toBeInTheDocument()
  })

  it('activates the subscription from the Checkout session on return, without waiting for the webhook', async () => {
    let activated = false
    const requests = mockBillingApi({
      billing: () => activated ? billingFor({ subscription: stripeSub() }) : billingFor(),
      activate: () => {
        activated = true
        return HttpResponse.json({ data: { activateHyloProCheckoutSession: { success: true, active: true } } })
      }
    })
    renderTab('/groups/hylo/settings/billing?checkout=success&session_id=cs_test_123')

    expect(await screen.findByText('Thanks for upgrading to Hylo Pro!')).toBeInTheDocument()
    expect(requests.ActivateHyloProCheckoutSession).toEqual([{ groupId: '1', sessionId: 'cs_test_123' }])
    expect(screen.getByTestId('billing-plan-name')).toHaveTextContent('Hylo Pro (monthly)')
    // checkout and session_id are removed from the URL so a refresh doesn't replay this
    await waitFor(() => expect(screen.getByTestId('location')).toBeEmptyDOMElement())
    expect(screen.getByText('Thanks for upgrading to Hylo Pro!')).toBeInTheDocument()
    expect(requests.ActivateHyloProCheckoutSession.length).toEqual(1)
  })

  it('does not offer a second subscription while waiting for the new one after Checkout', async () => {
    jest.useFakeTimers()
    try {
      let active = false
      mockBillingApi({
        billing: () => active ? billingFor({ subscription: stripeSub() }) : billingFor(),
        // The payment is still processing, so activation finds no subscription yet
        activate: () => HttpResponse.json({ data: { activateHyloProCheckoutSession: { success: true, active: false } } })
      })
      renderTab('/groups/hylo/settings/billing?checkout=success&session_id=cs_test_123')

      expect(await screen.findByTestId('billing-checkout-success')).toHaveTextContent('will appear here in a moment')
      expect(screen.getByTestId('billing-plan-name')).toHaveTextContent('Free')
      expect(screen.queryByTestId('billing-upgrade-month')).not.toBeInTheDocument()
      expect(screen.queryByTestId('billing-upgrade-year')).not.toBeInTheDocument()
      // Still polling, so the params stay
      expect(screen.getByTestId('location')).toHaveTextContent('checkout=success&session_id=cs_test_123')

      // The webhook lands; polling picks it up
      active = true
      jest.advanceTimersByTime(2000)

      expect(await screen.findByText('Thanks for upgrading to Hylo Pro!')).toBeInTheDocument()
      expect(screen.getByTestId('billing-plan-name')).toHaveTextContent('Hylo Pro (monthly)')
      expect(screen.queryByTestId('billing-upgrade-month')).not.toBeInTheDocument()
      await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('checkout='))
    } finally {
      jest.useRealTimers()
    }
  })
})
