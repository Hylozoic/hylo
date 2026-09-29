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
jest.mock('store/actions/fetchPaywallPreview', () => () => ({ type: 'TEST_FETCH_PREVIEW' }))

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
  let preview

  beforeEach(() => {
    preview = null
    mockNavigate.mockReset()
    mockDispatch.mockReset()
    mockDispatch.mockImplementation(action => {
      if (action.type === 'TEST_FETCH_OFFERINGS') {
        return Promise.resolve({ payload: { data: { publicStripeOfferings: { offerings: [offering] } } } })
      }
      if (action.type === 'TEST_FETCH_PREVIEW') {
        return Promise.resolve({ payload: { data: { group: { id: '1', paywallPreview: preview } } } })
      }
      return action
    })
  })

  it('shows the titles of pinned and recent posts above the offerings', async () => {
    preview = { postTitles: ['Welcome to the season', 'Planting schedule'], actionTitles: [], numActions: null, numPeopleCompleted: null }
    render(<PaywallOfferingsSection group={group} />)

    expect(await screen.findByText('Welcome to the season')).toBeInTheDocument()
    expect(screen.getByText('Planting schedule')).toBeInTheDocument()
    expect(screen.getByText('A look inside')).toBeInTheDocument()
  })

  it('shows a track\'s action titles and counts', async () => {
    preview = { postTitles: [], actionTitles: ['Read the guide'], numActions: 4, numPeopleCompleted: 1 }
    render(<PaywallOfferingsSection group={group} />)

    expect(await screen.findByText('Read the guide')).toBeInTheDocument()
    expect(screen.getByTestId('paywall-preview')).toHaveTextContent('paywallPreviewActions, paywallPreviewCompleted')
  })

  it('shows no preview when the stewards turned it off', async () => {
    render(<PaywallOfferingsSection group={group} />)

    expect(await screen.findByText('Season Pass')).toBeInTheDocument()
    expect(screen.queryByTestId('paywall-preview')).not.toBeInTheDocument()
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
