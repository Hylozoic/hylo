import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { groupUrl } from '@hylo/navigation'
import Loading from 'components/Loading'
import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import { cn } from 'util/index'
import {
  cancelHyloProSubscription,
  extendHyloProSubscription,
  fetchHyloProPayments,
  refundHyloProPayment,
  resumeHyloProSubscription,
  revokeHyloProGrant,
  updateHyloProGrant
} from './HyloPro.store'
import { endOfDayIso, formatDate, formatMoney, runGraphql, toDateInputValue } from './util'

const ENDED_STRIPE_STATUSES = ['canceled', 'incomplete_expired']
const EXTENDABLE_STRIPE_STATUSES = ['active', 'trialing']
// GraphQL error code for an extension past Stripe's trial limit (HyloProAdminService.EXTEND_LIMIT)
const EXTEND_LIMIT = 'HYLO_PRO_EXTEND_LIMIT'

function disputeStatusLabel (status, t) {
  switch (status) {
    case 'needs_response':
    case 'warning_needs_response': return t('Needs response')
    case 'under_review':
    case 'warning_under_review': return t('Under review')
    case 'appeal_needs_response': return t('Appeal needs response')
    case 'appeal_under_review': return t('Appeal under review')
    case 'won': return t('Won')
    case 'lost': return t('Lost')
    case 'warning_closed': return t('Closed')
    case 'prevented': return t('Prevented')
    default: return status
  }
}

function statusLabel (row, t) {
  if (row.source === 'manual') {
    if (row.status !== 'active') return t('Revoked')
    return row.active ? t('Active') : t('Expired')
  }
  switch (row.status) {
    case 'active': return t('Active')
    case 'trialing': return t('Trialing')
    case 'past_due': return t('Past due')
    case 'unpaid': return t('Unpaid')
    case 'incomplete': return t('Incomplete')
    case 'incomplete_expired': return t('Expired')
    case 'canceled': return t('Canceled')
    case 'paused': return t('Paused')
    default: return row.status
  }
}

/**
 * One Hylo Pro subscription or grant on the management page, with the actions that apply to it.
 */
export default function SubscriptionRow ({ row, onChanged }) {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()
  const [panel, setPanel] = useState(null) // 'endDate' | 'extend' | 'payments'
  const [busy, setBusy] = useState(false)
  const language = i18n.language
  const isGrant = row.source === 'manual'
  const stripeOpen = !isGrant && !ENDED_STRIPE_STATUSES.includes(row.status)

  const togglePanel = name => setPanel(current => current === name ? null : name)

  // Runs a mutation, then reloads the page's data; returns true on success. errorMessage(e) can
  // replace the server's message, e.g. to translate an error with a known code
  const run = useCallback(async (action, field, successMessage, errorMessage) => {
    setBusy(true)
    try {
      await runGraphql(dispatch, action, field)
      toast.success(successMessage)
      setPanel(null)
      onChanged()
      return true
    } catch (e) {
      toast.error(errorMessage?.(e) || e?.message || t('Something went wrong'))
      return false
    } finally {
      setBusy(false)
    }
  }, [dispatch, onChanged])

  const groupName = row.group?.name || t('Unknown group')

  const handleRevoke = () => {
    if (!window.confirm(t('Revoke Hylo Pro for {{name}} now?', { name: groupName }))) return
    run(revokeHyloProGrant(row.id), 'revokeHyloProGrant', t('Grant revoked'))
  }

  const handleCancel = immediately => {
    const message = immediately
      ? t('Cancel the subscription for {{name}} now? Pro stops immediately and nothing is refunded.', { name: groupName })
      : t('Cancel the subscription for {{name}} at the end of its paid period?', { name: groupName })
    if (!window.confirm(message)) return
    run(cancelHyloProSubscription(row.id, immediately), 'cancelHyloProSubscription', t('Subscription cancelled'))
  }

  const handleResume = () => {
    run(resumeHyloProSubscription(row.id), 'resumeHyloProSubscription', t('Cancellation undone'))
  }

  return (
    <li className='p-4 list-none' data-testid='hylo-pro-row'>
      <div className='flex flex-wrap items-start gap-3'>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2 flex-wrap'>
            {row.group
              ? <Link to={groupUrl(row.group.slug)} className='font-bold text-foreground hover:underline'>{groupName}</Link>
              : <span className='font-bold text-foreground'>{groupName}</span>}
            <span className='text-xs rounded-full px-2 py-0.5 bg-foreground/10 text-foreground/80'>
              {isGrant ? t('Grant') : t('Subscription')}
            </span>
            <span className={cn('text-xs rounded-full px-2 py-0.5', row.active ? 'bg-selected/30 text-foreground' : 'bg-foreground/10 text-foreground/60', row.status === 'past_due' && 'bg-yellow-500/20 text-yellow-600')}>
              {statusLabel(row, t)}
            </span>
          </div>
          <p className='text-xs text-foreground/60 m-0 mt-1'>
            {isGrant ? <GrantDetails row={row} t={t} language={language} /> : <SubscriptionDetails row={row} t={t} language={language} />}
          </p>
          {row.note && <p className='text-sm text-foreground/80 m-0 mt-1 whitespace-pre-wrap'>{row.note}</p>}
        </div>

        <div className='flex flex-wrap gap-2'>
          {isGrant && row.status === 'active' && (
            <>
              <Button size='sm' variant='outline' disabled={busy} onClick={() => togglePanel('endDate')}>{t('Change end date')}</Button>
              <Button size='sm' variant='destructive' disabled={busy} onClick={handleRevoke}>{t('Revoke')}</Button>
            </>
          )}
          {stripeOpen && EXTENDABLE_STRIPE_STATUSES.includes(row.status) && (
            <Button size='sm' variant='outline' disabled={busy} onClick={() => togglePanel('extend')}>{t('Extend')}</Button>
          )}
          {stripeOpen && (row.cancelAtPeriodEnd
            ? <Button size='sm' variant='outline' disabled={busy} onClick={handleResume}>{t('Undo cancellation')}</Button>
            : <Button size='sm' variant='outline' disabled={busy} onClick={() => handleCancel(false)}>{t('Cancel at period end')}</Button>)}
          {stripeOpen && (
            <Button size='sm' variant='destructive' disabled={busy} onClick={() => handleCancel(true)}>{t('Cancel now')}</Button>
          )}
          {!isGrant && (
            <Button size='sm' variant='ghost' disabled={busy} onClick={() => togglePanel('payments')}>{t('Payments')}</Button>
          )}
        </div>
      </div>

      {panel === 'endDate' && <EndDatePanel row={row} busy={busy} run={run} />}
      {panel === 'extend' && <ExtendPanel row={row} busy={busy} run={run} />}
      {panel === 'payments' && <PaymentsPanel row={row} canCancel={stripeOpen} onRefunded={onChanged} />}
    </li>
  )
}

function GrantDetails ({ row, t, language }) {
  const parts = [
    row.grantedBy
      ? t('Granted by {{name}} on {{date}}', { name: row.grantedBy.name, date: formatDate(row.createdAt, language) })
      : t('Granted on {{date}}', { date: formatDate(row.createdAt, language) })
  ]
  if (row.status !== 'active') parts.push(t('Revoked on {{date}}', { date: formatDate(row.endedAt, language) }))
  else if (row.expiresAt) parts.push(t('Ends on {{date}}', { date: formatDate(row.expiresAt, language) }))
  else parts.push(t('No end date'))
  return parts.join(' · ')
}

function SubscriptionDetails ({ row, t, language }) {
  const parts = []
  if (row.interval === 'month') parts.push(t('Monthly'))
  if (row.interval === 'year') parts.push(t('Yearly'))
  if (row.endedAt) {
    parts.push(t('Ended on {{date}}', { date: formatDate(row.endedAt, language) }))
  } else if (row.endsAt) {
    parts.push(t('Ends on {{date}}', { date: formatDate(row.endsAt, language) }))
  } else if (row.currentPeriodEnd) {
    parts.push(row.status === 'trialing'
      ? t('Next payment on {{date}}', { date: formatDate(row.currentPeriodEnd, language) })
      : t('Renews on {{date}}', { date: formatDate(row.currentPeriodEnd, language) }))
  }
  parts.push(t('Started {{date}}', { date: formatDate(row.createdAt, language) }))
  if (row.stripeSubscriptionId) parts.push(row.stripeSubscriptionId)
  return parts.join(' · ')
}

function EndDatePanel ({ row, busy, run }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(toDateInputValue(row.expiresAt))

  const save = expiresAt => run(updateHyloProGrant({ id: row.id, expiresAt }), 'updateHyloProGrant', t('Grant updated'))

  return (
    <form
      className='mt-3 flex flex-wrap items-end gap-2 bg-card rounded-md p-3 border border-foreground/10'
      onSubmit={e => { e.preventDefault(); save(endOfDayIso(value)) }}
    >
      <label className='text-sm text-foreground space-y-1'>
        <span>{t('Ends on')}</span>
        <Input type='date' className='h-9' value={value} onChange={e => setValue(e.target.value)} required />
      </label>
      <Button type='submit' size='sm' disabled={busy || !value}>{t('Save')}</Button>
      <Button type='button' size='sm' variant='outline' disabled={busy} onClick={() => save(null)}>{t('Remove end date')}</Button>
    </form>
  )
}

function ExtendPanel ({ row, busy, run }) {
  const { t } = useTranslation()
  const [days, setDays] = useState('30')
  const count = Number(days)
  const valid = Number.isInteger(count) && count >= 1 && count <= 366

  // Stripe can't push the next payment more than 730 days ahead; the server says how many days are left
  const limitMessage = e => {
    const extensions = e?.extensions
    if (extensions?.code !== EXTEND_LIMIT) return null
    return extensions.maxDays > 0
      ? t('Stripe allows free time up to {{limit}} days from today, so this subscription can be extended by at most {{days}} more days.', { limit: extensions.maxTrialDays, days: extensions.maxDays })
      : t('This subscription is already extended as far as Stripe allows ({{limit}} days from today).', { limit: extensions.maxTrialDays })
  }

  return (
    <form
      className='mt-3 space-y-2 bg-card rounded-md p-3 border border-foreground/10'
      onSubmit={e => {
        e.preventDefault()
        if (valid) run(extendHyloProSubscription(row.id, count), 'extendHyloProSubscription', t('Subscription extended'), limitMessage)
      }}
    >
      <p className='text-xs text-foreground/60 m-0'>
        {t('Adds free days by moving the next payment back (a Stripe trial). The group keeps Pro until then and is then charged the full price, on the new date from then on. Nothing is refunded.')}
      </p>
      <div className='flex flex-wrap items-end gap-2'>
        <label className='text-sm text-foreground space-y-1'>
          <span>{t('Days to add')}</span>
          <Input type='number' min='1' max='366' step='1' className='h-9 w-28' value={days} onChange={e => setDays(e.target.value)} />
        </label>
        <Button type='submit' size='sm' disabled={busy || !valid}>{t('Extend')}</Button>
      </div>
    </form>
  )
}

/**
 * The group's Pro payments, newest first, a page at a time, with refunds. Disputed payments are
 * marked with the dispute's status; the server's refundBlock says when that stops a refund (an open
 * chargeback, which Stripe settles through the dispute, or a lost one, already paid back).
 * "Also cancel the subscription now" cancels this row's subscription once the refund succeeds, and
 * is only offered on payments for this row's subscription.
 */
function PaymentsPanel ({ row, canCancel, onRefunded }) {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()
  const [payments, setPayments] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [amounts, setAmounts] = useState({})
  const [cancelToo, setCancelToo] = useState({})
  const [refundingId, setRefundingId] = useState(null)
  const groupId = row.group?.id
  const groupName = row.group?.name

  // Cancelling with a refund only makes sense for a payment of this row's subscription (the server checks too)
  const canCancelWith = payment => canCancel && !!payment.subscriptionId && payment.subscriptionId === row.stripeSubscriptionId

  // Reloads the first page (after = null) or adds the next page after the last payment shown
  const load = useCallback(async after => {
    try {
      const page = await runGraphql(dispatch, fetchHyloProPayments(groupId, after), 'hyloProPayments')
      const items = page?.items || []
      setPayments(existing => after ? (existing || []).concat(items) : items)
      setHasMore(!!page?.hasMore)
      setError(null)
    } catch (e) {
      if (after) toast.error(e?.message || t('Something went wrong'))
      else setError(e?.message || t('Something went wrong'))
    }
  }, [dispatch, groupId])

  useEffect(() => { load() }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    await load(payments[payments.length - 1].id)
    setLoadingMore(false)
  }

  const handleRefund = async payment => {
    const refundable = payment.amount - payment.amountRefunded
    const typed = (amounts[payment.id] || '').trim()
    const cents = typed ? Math.round(Number(typed) * 100) : refundable
    if (!Number.isInteger(cents) || cents < 1 || cents > refundable) {
      toast.error(t('Enter an amount up to {{amount}}', { amount: formatMoney(refundable, payment.currency, i18n.language) }))
      return
    }
    const amountText = formatMoney(cents, payment.currency, i18n.language)
    const cancel = canCancelWith(payment) && !!cancelToo[payment.id]
    const question = cancel
      ? t('Refund {{amount}} to {{name}} and cancel the subscription now? Pro stops immediately.', { amount: amountText, name: groupName })
      : t('Refund {{amount}} to {{name}}? This does not cancel the subscription.', { amount: amountText, name: groupName })
    if (!window.confirm(question)) return

    setRefundingId(payment.id)
    try {
      const result = await runGraphql(dispatch, refundHyloProPayment({
        groupId,
        chargeId: payment.id,
        amount: cents === refundable ? null : cents,
        cancelSubscriptionId: cancel ? row.id : null
      }), 'refundHyloProPayment')
      if (!cancel) {
        toast.success(t('Refunded {{amount}}', { amount: amountText }))
      } else if (result?.subscriptionCanceled) {
        toast.success(t('Refunded {{amount}} and cancelled the subscription', { amount: amountText }))
      } else {
        // The refund went through but the cancellation didn't: say so, so staff cancel it separately
        toast.error(t('Refunded {{amount}}, but cancelling the subscription failed: {{error}}. Use Cancel now to try again.', { amount: amountText, error: result?.cancelError || t('Something went wrong') }))
      }
      setAmounts(a => ({ ...a, [payment.id]: '' }))
      setCancelToo(c => ({ ...c, [payment.id]: false }))
      // Update the refunded payment in place, keeping any pages loaded with "Load more"
      const refunded = result?.amount ?? cents
      setPayments(list => list.map(p => {
        if (p.id !== payment.id) return p
        const amountRefunded = p.amountRefunded + refunded
        return { ...p, amountRefunded, refunded: amountRefunded >= p.amount }
      }))
      onRefunded()
    } catch (e) {
      toast.error(e?.message || t('Something went wrong'))
    } finally {
      setRefundingId(null)
    }
  }

  if (error) return <div className='mt-3 text-sm text-red-500'>{error}</div>
  if (!payments) return <div className='mt-3'><Loading /></div>
  if (payments.length === 0) return <div className='mt-3 text-sm text-foreground/50'>{t('No payments yet.')}</div>

  return (
    <div className='mt-3 overflow-x-auto bg-card rounded-md p-3 border border-foreground/10 space-y-2' data-testid='hylo-pro-payments'>
      <table className='w-full text-sm text-left border-collapse'>
        <thead>
          <tr className='border-b border-foreground/10 text-foreground/50 text-xs uppercase'>
            <th className='py-2 pr-4'>{t('Date')}</th>
            <th className='py-2 pr-4'>{t('Description')}</th>
            <th className='py-2 pr-4 text-right'>{t('Amount')}</th>
            <th className='py-2 pr-4 text-right'>{t('Refunded')}</th>
            <th className='py-2 pr-4'>{t('Refund')}</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(payment => {
            const refundable = payment.paid && !payment.refundBlock ? payment.amount - payment.amountRefunded : 0
            return (
              <tr key={payment.id} className='border-b border-foreground/5' data-testid='hylo-pro-payment'>
                <td className='py-2 pr-4 text-foreground'>{formatDate(payment.createdAt, i18n.language)}</td>
                <td className='py-2 pr-4 text-foreground/70'>
                  {payment.description || payment.id}{!payment.paid && ` (${payment.status})`}
                  {payment.disputed && (
                    <span className='ml-2 text-xs rounded-full px-2 py-0.5 bg-red-500/15 text-red-600 whitespace-nowrap' data-testid='hylo-pro-disputed'>
                      {payment.disputeStatus
                        ? t('Disputed: {{status}}', { status: disputeStatusLabel(payment.disputeStatus, t) })
                        : t('Disputed')}
                    </span>
                  )}
                </td>
                <td className='py-2 pr-4 text-right text-foreground'>{formatMoney(payment.amount, payment.currency, i18n.language)}</td>
                <td className='py-2 pr-4 text-right text-foreground'>{payment.amountRefunded ? formatMoney(payment.amountRefunded, payment.currency, i18n.language) : '—'}</td>
                <td className='py-2 pr-4'>
                  {refundable > 0 && (
                    <div className='flex flex-wrap items-center gap-2'>
                      <Input
                        className='h-8 w-24'
                        inputMode='decimal'
                        placeholder={(refundable / 100).toFixed(2)}
                        aria-label={t('Amount to refund')}
                        value={amounts[payment.id] || ''}
                        onChange={e => setAmounts(a => ({ ...a, [payment.id]: e.target.value }))}
                      />
                      <Button size='sm' variant='outline' disabled={refundingId === payment.id} onClick={() => handleRefund(payment)}>
                        {t('Refund')}
                      </Button>
                      {canCancelWith(payment) && (
                        <label className='flex items-center gap-1 text-xs text-foreground'>
                          <input
                            type='checkbox'
                            checked={!!cancelToo[payment.id]}
                            onChange={e => setCancelToo(c => ({ ...c, [payment.id]: e.target.checked }))}
                            data-testid='hylo-pro-refund-cancel'
                          />
                          <span>{t('Also cancel the subscription now (after the refund)')}</span>
                        </label>
                      )}
                    </div>
                  )}
                  {payment.refundBlock === 'dispute_open' && <span className='text-xs text-foreground/50'>{t('Handle in Stripe')}</span>}
                  {payment.refundBlock === 'dispute_lost' && <span className='text-xs text-foreground/50'>{t('Dispute lost: already returned to the customer')}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {hasMore && (
        <Button size='sm' variant='outline' disabled={loadingMore} onClick={loadMore}>{t('Load more')}</Button>
      )}
    </div>
  )
}
