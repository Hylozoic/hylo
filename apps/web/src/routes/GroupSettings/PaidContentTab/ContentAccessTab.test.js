import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from 'util/testing/reactTestingLibraryExtended'
import refundContentAccess from 'store/actions/refundContentAccess'
import { ContentAccessRecordItem } from './ContentAccessTab'

jest.mock('store/actions/refundContentAccess', () => jest.fn(() => ({ type: 'TEST_REFUND_CONTENT_ACCESS' })))

const t = (str, params) => {
  if (!params) return str
  return Object.entries(params).reduce((result, [key, value]) => result.replace(`{{${key}}}`, value), str)
}

const baseRecord = {
  id: '7',
  user: { id: '3', name: 'Sam Member' },
  offering: { id: '5', name: 'Season Pass' },
  group: { id: '1', name: 'Garden Club' },
  accessType: 'stripe_purchase',
  status: 'active',
  createdAt: '2026-09-01T00:00:00.000Z'
}

function renderRecord (record) {
  return render(<ContentAccessRecordItem record={{ ...baseRecord, ...record }} parentGroupId='1' t={t} onActionComplete={jest.fn()} />)
}

async function openRefundDialog (user) {
  await user.click(screen.getAllByRole('button')[0])
  await user.click(await screen.findByText('Refund'))
  await screen.findByText('Refund Purchase')
}

describe('ContentAccessRecordItem refund', () => {
  beforeEach(() => {
    refundContentAccess.mockClear()
  })

  it('explains that a refund keeps access, with no cancel option for a one-time purchase', async () => {
    const user = userEvent.setup()
    renderRecord()

    await openRefundDialog(user)

    expect(screen.getByText('This will refund the most recent payment from Sam Member. Their access stays in place. To remove their access, revoke it or remove them from the group.')).toBeInTheDocument()
    expect(screen.queryByText(/revoke access for/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Also cancel future payments')).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Refund' }).at(-1))
    await waitFor(() => expect(refundContentAccess).toHaveBeenCalledWith({
      accessId: '7',
      reason: 'Refunded by admin',
      cancelFuturePayments: false
    }))
  })

  it('offers Also cancel future payments for a subscription, off by default', async () => {
    const user = userEvent.setup()
    renderRecord({ stripeSubscriptionId: 'sub_123' })

    await openRefundDialog(user)

    const checkbox = screen.getByLabelText('Also cancel future payments')
    expect(checkbox).not.toBeChecked()

    await user.click(screen.getAllByRole('button', { name: 'Refund' }).at(-1))
    await waitFor(() => expect(refundContentAccess).toHaveBeenCalledWith(expect.objectContaining({ cancelFuturePayments: false })))
  })

  it('passes the choice to cancel future payments when the steward ticks it', async () => {
    const user = userEvent.setup()
    renderRecord({ stripeSubscriptionId: 'sub_123' })

    await openRefundDialog(user)
    await user.click(screen.getByLabelText('Also cancel future payments'))
    expect(screen.getByLabelText('Also cancel future payments')).toBeChecked()

    await user.click(screen.getAllByRole('button', { name: 'Refund' }).at(-1))
    await waitFor(() => expect(refundContentAccess).toHaveBeenCalledWith(expect.objectContaining({ cancelFuturePayments: true })))
  })

  it('shows a Refunded badge next to Active for a refunded purchase and hides Refund for a one-time purchase', async () => {
    const user = userEvent.setup()
    renderRecord({ refundedAt: '2026-09-20T00:00:00.000Z', refundedAmount: 1500 })

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Refunded')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button')[0])
    expect(await screen.findByText('Revoke Access')).toBeInTheDocument()
    expect(screen.queryByText('Refund')).not.toBeInTheDocument()
  })

  it('shows the Refunded status for a purchase the earlier Refund button marked refunded', () => {
    renderRecord({ status: 'refunded' })

    expect(screen.getAllByText('Refunded')).toHaveLength(1)
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })
})
