import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PaymentSettingsTab from './PaymentSettingsTab'

describe('PaymentSettingsTab', () => {
  const defaultProps = {
    currentUser: { hasFeature: () => true, hasStripeAccount: false },
    updateUserSettings: jest.fn(),
    queryParams: {}
  }

  it('renders correctly when user has no Stripe account', () => {
    render(<PaymentSettingsTab {...defaultProps} />)

    expect(screen.getByText('Connect Stripe Account')).toBeInTheDocument()
    expect(screen.getByText(/Click the button below to create a free Stripe account/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link Stripe Account' })).toBeInTheDocument()
  })

  it('renders correctly when user has a Stripe account', () => {
    const props = {
      ...defaultProps,
      currentUser: { ...defaultProps.currentUser, hasStripeAccount: true }
    }
    render(<PaymentSettingsTab {...props} />)

    expect(screen.getByText('Connect Stripe Account')).toBeInTheDocument()
    expect(screen.getByText(/You already have a stripe account linked to this account/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link Stripe Account' })).toBeInTheDocument()
  })

  it('renders success notification when registration is successful', () => {
    const props = {
      ...defaultProps,
      queryParams: { registered: 'success' }
    }
    render(<PaymentSettingsTab {...props} />)

    expect(screen.getByText(/Your account is registered/)).toBeInTheDocument()
  })

  it('renders error notification when registration fails', () => {
    const props = {
      ...defaultProps,
      queryParams: { registered: 'error' }
    }
    render(<PaymentSettingsTab {...props} />)

    expect(screen.getByText(/There was an issue registering your stripe account/)).toBeInTheDocument()
  })

  it('does not render anything when user does not have PROJECT_CONTRIBUTIONS feature', () => {
    const props = {
      ...defaultProps,
      currentUser: { ...defaultProps.currentUser, hasFeature: () => false }
    }
    const { container } = render(<PaymentSettingsTab {...props} />)

    expect(container).toBeEmptyDOMElement()
  })
})
