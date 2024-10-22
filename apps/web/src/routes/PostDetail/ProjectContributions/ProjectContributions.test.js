import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import ProjectContributions from './ProjectContributions'
import { AllTheProviders } from 'util/testing/reactTestingLibraryExtended'

describe('ProjectContributions', () => {
  const defaultProps = {
    postId: 123,
    totalContributions: 321,
    stripeKey: 'test_stripe_key',
    processStripeToken: jest.fn(),
  }

  it('renders correctly', () => {
    render(<ProjectContributions {...defaultProps} />, { wrapper: AllTheProviders })
    expect(screen.getByText('Contribute')).toBeInTheDocument()
    expect(screen.getByText('Contributions so far: 321')).toBeInTheDocument()
  })

  it('toggles expanded correctly', () => {
    render(<ProjectContributions {...defaultProps} />, { wrapper: AllTheProviders })
    fireEvent.click(screen.getByText('Contribute'))
    expect(screen.getByText('Amount')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('renders received message', async () => {
    const { rerender } = render(<ProjectContributions {...defaultProps} />, { wrapper: AllTheProviders })
    fireEvent.click(screen.getByText('Contribute'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10' } })

    // Simulate successful payment
    defaultProps.processStripeToken.mockResolvedValue({ error: false })
    fireEvent.click(screen.getByText('Pay with card'))

    await waitFor(() => {
      expect(screen.getByText('Thanks for your contribution!')).toBeInTheDocument()
    })
  })

  it('renders error message', async () => {
    const { rerender } = render(<ProjectContributions {...defaultProps} />, { wrapper: AllTheProviders })
    fireEvent.click(screen.getByText('Contribute'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10' } })

    // Simulate failed payment
    defaultProps.processStripeToken.mockResolvedValue({ error: true })
    fireEvent.click(screen.getByText('Pay with card'))

    await waitFor(() => {
      expect(screen.getByText('There was a problem processing your payment. Please check your card details and try again.')).toBeInTheDocument()
    })
  })

  it('disables button on invalid amount', () => {
    render(<ProjectContributions {...defaultProps} />, { wrapper: AllTheProviders })
    fireEvent.click(screen.getByText('Contribute'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12fc' } })
    expect(screen.getByText('Pay with card')).toBeDisabled()
  })
})
