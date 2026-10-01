import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AllTheProviders, render } from 'util/testing/reactTestingLibraryExtended'
import PaymentSuccess from './PaymentSuccess'

const mockDispatch = jest.fn()

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch
}))

jest.mock('store/actions/fulfillStripeCheckoutSession', () => (sessionId, offeringId) => ({ type: 'TEST_FULFILL', sessionId, offeringId }))
jest.mock('store/actions/fetchForCurrentUser', () => () => ({ type: 'TEST_FETCH_CURRENT_USER' }))

function renderPage () {
  return render(<PaymentSuccess />, null, AllTheProviders({}, ['/groups/garden-club/payment/success?session_id=cs_test&offering_id=5']))
}

const fulfillCalls = () => mockDispatch.mock.calls.filter(([action]) => action.type === 'TEST_FULFILL')

describe('PaymentSuccess', () => {
  beforeEach(() => {
    mockDispatch.mockReset()
  })

  it('confirms the purchase when access was granted', async () => {
    mockDispatch.mockResolvedValue({})
    renderPage()

    expect(await screen.findByText('Thank you for your purchase. Your access to this group has been granted.')).toBeInTheDocument()
    expect(fulfillCalls()).toHaveLength(1)
    expect(fulfillCalls()[0][0]).toMatchObject({ sessionId: 'cs_test', offeringId: '5' })
  })

  it('says the payment was received, with a retry and a link to My Transactions, when access is not granted yet', async () => {
    mockDispatch.mockImplementation(action => action.type === 'TEST_FULFILL'
      ? Promise.reject(new Error('Payment is not complete yet'))
      : Promise.resolve({}))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    renderPage()

    expect(await screen.findByText("Payment received, we're finishing setting up your access")).toBeInTheDocument()
    expect(screen.queryByText('Thank you for your purchase. Your access to this group has been granted.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My Transactions' })).toHaveAttribute('href', '/my/transactions')
    expect(mockDispatch.mock.calls.some(([action]) => action.type === 'TEST_FETCH_CURRENT_USER')).toBe(false)
    console.error.mockRestore()
  })

  it('tries again and shows the success state once access is granted', async () => {
    mockDispatch.mockImplementationOnce(() => Promise.reject(new Error('Payment is not complete yet')))
    mockDispatch.mockResolvedValue({})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Try Again' }))

    expect(await screen.findByText('Thank you for your purchase. Your access to this group has been granted.')).toBeInTheDocument()
    expect(fulfillCalls()).toHaveLength(2)
    console.error.mockRestore()
  })
})
