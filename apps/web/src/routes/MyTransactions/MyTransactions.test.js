import React from 'react'
import { screen } from '@testing-library/react'
import { render } from 'util/testing/reactTestingLibraryExtended'
import { TransactionCard } from './MyTransactions'

const t = (str, params) => {
  if (!params) return str
  return Object.entries(params).reduce((result, [key, value]) => result.replace(`{{${key}}}`, value), str)
}

const baseTransaction = {
  id: '9',
  offeringName: 'Season Pass',
  offering: { id: '5', name: 'Season Pass' },
  group: { id: '1', name: 'Garden Club', slug: 'garden-club' },
  groupName: 'Garden Club',
  accessType: 'group',
  status: 'active',
  purchaseDate: '2026-09-01T00:00:00.000Z',
  paymentType: 'one_time',
  amountPaid: 1500,
  currency: 'usd'
}

function renderCard (transaction) {
  return render(<TransactionCard transaction={{ ...baseTransaction, ...transaction }} t={t} />)
}

describe('TransactionCard', () => {
  it('shows a refunded purchase as still active, with a Refunded badge and the refund', () => {
    renderCard({ refundedAt: '2026-09-20T12:00:00.000Z', refundedAmount: 1500 })

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getAllByText('Refunded')).toHaveLength(1)
    expect(screen.getByText('Refunded:')).toBeInTheDocument()
    expect(screen.getByText(/\$15\.00 · /)).toBeInTheDocument()
  })

  it('labels a purchase the earlier Refund button marked refunded as Refunded, not Revoked', () => {
    renderCard({ status: 'refunded' })

    expect(screen.getByText('Refunded')).toBeInTheDocument()
    expect(screen.queryByText('Revoked')).not.toBeInTheDocument()
  })

  it('shows no refund details for a purchase that was not refunded', () => {
    renderCard()

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.queryByText('Refunded')).not.toBeInTheDocument()
    expect(screen.queryByText('Refunded:')).not.toBeInTheDocument()
  })
})
