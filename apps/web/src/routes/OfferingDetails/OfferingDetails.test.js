import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from 'util/testing/reactTestingLibraryExtended'
import OfferingDetails from './OfferingDetails'

const mockNavigate = jest.fn()
const mockDispatch = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ offeringId: '5', groupSlug: 'garden-club' }),
  useLocation: () => ({ pathname: '/groups/garden-club/offerings/5', search: '' })
}))

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}))

jest.mock('store/actions/fetchPublicStripeOffering', () => () => ({ type: 'TEST_FETCH_OFFERING' }))

const offering = {
  id: '5',
  name: 'Season Pass',
  priceInCents: 150000,
  currency: 'jpy',
  duration: null,
  accessGrants: { groupIds: ['1'] },
  group: { id: '1', slug: 'garden-club', name: 'Garden Club' }
}

describe('OfferingDetails', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockDispatch.mockReset()
    mockDispatch.mockImplementation(action => action.type === 'TEST_FETCH_OFFERING'
      ? Promise.resolve({ payload: { data: { publicStripeOffering: offering } } })
      : action)
  })

  it('shows the price in the offering currency', async () => {
    render(<OfferingDetails />)

    expect(await screen.findByText('¥150,000')).toBeInTheDocument()
  })

  it('sends a signed-out buyer to sign up, returning to the offering afterwards', async () => {
    const user = userEvent.setup()
    render(<OfferingDetails />)

    await user.click(await screen.findByRole('button', { name: 'Sign up to Purchase' }))

    expect(mockNavigate).toHaveBeenCalledWith('/signup?returnToUrl=' + encodeURIComponent('/groups/garden-club/offerings/5'))
  })
})
