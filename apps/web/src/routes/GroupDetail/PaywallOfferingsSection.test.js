import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from 'util/testing/reactTestingLibraryExtended'
import PaywallOfferingsSection from './PaywallOfferingsSection'

const mockNavigate = jest.fn()
const mockDispatch = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/groups/garden-club', search: '?tab=about' })
}))

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}))

jest.mock('store/actions/fetchPublicStripeOfferings', () => () => ({ type: 'TEST_FETCH_OFFERINGS' }))

const group = { id: '1', slug: 'garden-club', name: 'Garden Club', paywall: true, type: 'group' }

const offering = {
  id: '5',
  name: 'Season Pass',
  priceInCents: 1500,
  currency: 'eur',
  duration: null,
  accessGrants: { groupIds: ['1'] }
}

describe('PaywallOfferingsSection', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockDispatch.mockReset()
    mockDispatch.mockImplementation(action => action.type === 'TEST_FETCH_OFFERINGS'
      ? Promise.resolve({ payload: { data: { publicStripeOfferings: { offerings: [offering] } } } })
      : action)
  })

  it('sends a signed-out buyer to sign up, returning to this page afterwards', async () => {
    const user = userEvent.setup()
    render(<PaywallOfferingsSection group={group} />)

    await user.click(await screen.findByRole('button', { name: 'Sign up to Purchase' }))

    expect(mockNavigate).toHaveBeenCalledWith('/signup?returnToUrl=' + encodeURIComponent('/groups/garden-club?tab=about'))
  })

  it('shows the price in the offering currency', async () => {
    render(<PaywallOfferingsSection group={group} />)

    expect(await screen.findByText('Price: €15.00')).toBeInTheDocument()
  })
})
