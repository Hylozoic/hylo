/**
 * MyTransactions component
 *
 * Displays a list of the user's purchases and subscriptions.
 * Allows users to manage their subscriptions via Stripe billing portal.
 */

import { CreditCard, ExternalLink } from 'lucide-react'
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import ChangeSubscriptionModal from './ChangeSubscriptionModal'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Loading from 'components/Loading'
import { Label } from 'components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'components/ui/select'
import { cn } from 'util/index'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchMyTransactions from 'store/actions/fetchMyTransactions'
import { membershipChangeDefersToPeriodEnd } from 'util/membershipChangeModes'
import { getMyTransactions } from 'store/reducers/myTransactions'

const filterSelectTriggerClassName = cn(
  'h-10 w-full text-sm font-medium',
  /* Contrast with parent `bg-card` (avoid `bg-card` on `bg-card`) */
  'bg-muted/60 text-foreground dark:bg-muted/40',
  'border-2 border-foreground/25 shadow-sm',
  'ring-offset-0 focus:ring-inset focus:ring-offset-0',
  'hover:border-foreground/40 hover:bg-muted/80 dark:hover:bg-muted/55',
  'focus:ring-2 focus:ring-ring',
  'data-[state=open]:border-foreground/45 data-[state=open]:bg-muted/85 dark:data-[state=open]:bg-muted/60',
  /* Radix SelectValue + chevron: avoid faint / same-as-bg look */
  '[&>span]:text-foreground',
  '[&_svg]:opacity-100 [&_svg]:text-foreground/80'
)

/**
 * Formats a date for display
 */
function formatDate (date) {
  if (!date) return null
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Formats price from cents to display string
 */
function formatPrice (cents, currency = 'usd') {
  if (!cents) return null
  const dollars = cents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(dollars)
}

/**
 * Hylo offering.duration → billing cadence label (subscriptions).
 */
function billingPeriodLabelForDuration (duration, t) {
  switch (duration) {
    case 'day':
      return t('transactions.billingPeriod.day')
    case 'month':
      return t('transactions.billingPeriod.month')
    case 'season':
      return t('transactions.billingPeriod.season')
    case 'annual':
      return t('transactions.billingPeriod.annual')
    case 'lifetime':
      return t('transactions.billingPeriod.lifetime')
    default:
      return null
  }
}

/**
 * Short suffix after formatted price (e.g. "per 3 months").
 */
function priceCadenceSuffixForDuration (duration, t) {
  switch (duration) {
    case 'day':
      return t('transactions.priceCadence.day')
    case 'month':
      return t('transactions.priceCadence.month')
    case 'season':
      return t('transactions.priceCadence.season')
    case 'annual':
      return t('transactions.priceCadence.annual')
    default:
      return null
  }
}

/**
 * Copy for pendingMembershipSubscriptionChange on a subscription transaction.
 */
function pendingMembershipChangeDescription (pending, t) {
  if (!pending?.mode) return null
  const offeringName = pending.toOffering?.name || t('Unnamed Offering')
  const dateStr = pending.effectiveAt ? formatDate(pending.effectiveAt) : null
  if (pending.mode === 'scheduled_period_end') {
    return dateStr
      ? t('transactions.pendingChange.scheduled_period_end', { offeringName, date: dateStr })
      : t('transactions.pendingChange.scheduled_period_end_noDate', { offeringName })
  }
  if (pending.mode === 'lifetime_no_proration') {
    return dateStr
      ? t('transactions.pendingChange.lifetime_no_proration', { date: dateStr })
      : t('transactions.pendingChange.lifetime_no_proration_noDate')
  }
  return t('transactions.pendingChange.generic', {
    offeringName,
    date: dateStr || ''
  })
}

/**
 * Transaction card component
 */
function TransactionCard ({ transaction, t, onMembershipChangeCommitted }) {
  const [changeSubscriptionOpen, setChangeSubscriptionOpen] = useState(false)
  const {
    offeringName,
    offering,
    group,
    groupName,
    trackName,
    accessType,
    status,
    purchaseDate,
    expiresAt,
    paymentType,
    subscriptionStatus,
    currentPeriodEnd,
    subscriptionCancelAtPeriodEnd,
    subscriptionPeriodEnd,
    amountPaid,
    currency,
    manageUrl,
    receiptUrl,
    pendingMembershipSubscriptionChange
  } = transaction

  // Determine status badge color
  const getStatusColor = () => {
    if (subscriptionCancelAtPeriodEnd) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    if (status === 'active') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    if (status === 'expired') return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    if (status === 'revoked') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    return 'bg-gray-100 text-gray-800'
  }

  // Get status label
  const getStatusLabel = () => {
    if (subscriptionCancelAtPeriodEnd) return t('Cancelling')
    if (status === 'active') return t('Active')
    if (status === 'expired') return t('Expired')
    return t('Revoked')
  }

  // Format access type for display
  const getAccessTypeLabel = () => {
    if (accessType === 'track') return t('Track')
    if (accessType === 'role') return t('Role')
    return t('Group')
  }

  // Get the group URL
  const groupUrl = group?.slug ? `/groups/${group.slug}` : null

  const showChangeSubscription =
    paymentType === 'subscription' &&
    status === 'active' &&
    group?.id &&
    (offering?.id != null)

  const currentOfferingName = offeringName || offering?.name

  // Determine the primary action URL based on payment type
  const stripeActionUrl = paymentType === 'subscription' ? manageUrl : receiptUrl
  const stripeActionLabel = paymentType === 'subscription'
    ? t('Manage in Stripe')
    : t('View in Stripe')

  return (
    <div className='bg-card border border-border rounded-lg p-4 flex flex-col gap-4'>
      {/* Header row */}
      <div className='flex items-start justify-between'>
        <h3 className='font-semibold text-foreground text-lg'>
          {offeringName || t('Unnamed Offering')}
        </h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
          {getStatusLabel()}
        </span>
      </div>

      {paymentType === 'subscription' && pendingMembershipSubscriptionChange && (
        <div
          className='rounded-md border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm text-foreground shadow-sm'
          role='status'
        >
          <p className='font-medium'>{t('transactions.pendingChangeTitle')}</p>
          <p className='mt-1 leading-snug text-muted-foreground'>
            {pendingMembershipChangeDescription(pendingMembershipSubscriptionChange, t)}
          </p>
        </div>
      )}

      {/* Details grid */}
      <div className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
        {/* Group */}
        <div className='text-muted-foreground'>{t('Group')}:</div>
        <div className='text-foreground'>
          {groupUrl
            ? (
              <a href={groupUrl} className='text-accent hover:underline'>
                {groupName}
              </a>
              )
            : groupName}
        </div>

        {/* Track (if applicable) */}
        {trackName && (
          <>
            <div className='text-muted-foreground'>{t('Track')}:</div>
            <div className='text-foreground'>{trackName}</div>
          </>
        )}

        {/* Access Type */}
        <div className='text-muted-foreground'>{t('Access Type')}:</div>
        <div className='text-foreground'>{getAccessTypeLabel()}</div>

        {/* Payment Type */}
        <div className='text-muted-foreground'>{t('Payment Type')}:</div>
        <div className='text-foreground'>
          {paymentType === 'subscription' ? t('Subscription') : t('One-time purchase')}
        </div>

        {/* Billing period (Hylo offering duration; avoids implying every plan is monthly) */}
        {paymentType === 'subscription' && billingPeriodLabelForDuration(offering?.duration, t) && (
          <>
            <div className='text-muted-foreground'>{t('transactions.billingPeriodLabel')}:</div>
            <div className='text-foreground'>{billingPeriodLabelForDuration(offering?.duration, t)}</div>
          </>
        )}

        {/* Amount */}
        {amountPaid && (
          <>
            <div className='text-muted-foreground'>{t('Amount')}:</div>
            <div className='text-foreground font-medium'>
              {formatPrice(amountPaid, currency)}
              {paymentType === 'subscription' && priceCadenceSuffixForDuration(offering?.duration, t) && (
                <span className='text-muted-foreground font-normal'>
                  {' '}
                  {priceCadenceSuffixForDuration(offering?.duration, t)}
                </span>
              )}
            </div>
          </>
        )}

        {/* Purchase Date */}
        <div className='text-muted-foreground'>{t('Purchased')}:</div>
        <div className='text-foreground'>{formatDate(purchaseDate)}</div>

        {/* Renewal/Expiration */}
        {paymentType === 'subscription' && (
          <>
            {subscriptionCancelAtPeriodEnd && subscriptionPeriodEnd && (
              <>
                <div className='text-muted-foreground'>{t('Cancels')}:</div>
                <div className='text-orange-600 dark:text-orange-400'>
                  {formatDate(subscriptionPeriodEnd)}
                </div>
              </>
            )}
            {!subscriptionCancelAtPeriodEnd && currentPeriodEnd && (
              <>
                <div className='text-muted-foreground'>
                  {subscriptionStatus === 'active' ? t('Renews') : t('Status')}:
                </div>
                <div className='text-foreground'>
                  {subscriptionStatus === 'active'
                    ? formatDate(currentPeriodEnd)
                    : subscriptionStatus}
                </div>
              </>
            )}
          </>
        )}
        {paymentType === 'one_time' && expiresAt && (
          <>
            <div className='text-muted-foreground'>{t('Expires')}:</div>
            <div className='text-foreground'>{formatDate(expiresAt)}</div>
          </>
        )}
      </div>

      {/* Change subscription + Stripe Action */}
      <div className='pt-2 border-t border-border flex flex-col sm:flex-row flex-wrap gap-2'>
        {showChangeSubscription && (
          <>
            <button
              type='button'
              onClick={() => setChangeSubscriptionOpen(true)}
              className='inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border-2 border-foreground/20 bg-background text-foreground hover:border-foreground/50 transition-colors'
            >
              {t('Change subscription')}
            </button>
            <ChangeSubscriptionModal
              open={changeSubscriptionOpen}
              onClose={() => setChangeSubscriptionOpen(false)}
              groupId={group.id}
              fromOfferingId={offering.id}
              currentOfferingName={currentOfferingName}
              subscriptionStatus={subscriptionStatus}
              onCommitted={(commitResult) => {
                if (typeof onMembershipChangeCommitted === 'function') {
                  onMembershipChangeCommitted(commitResult)
                }
              }}
            />
          </>
        )}
        {stripeActionUrl && (
          <a
            href={stripeActionUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
          >
            <CreditCard className='w-4 h-4' />
            {stripeActionLabel}
            <ExternalLink className='w-3 h-3' />
          </a>
        )}
      </div>
    </div>
  )
}

/**
 * Main MyTransactions component
 */
function MyTransactions () {
  const dispatch = useDispatch()
  const { t } = useTranslation()

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all')
  const [offeringFilter, setOfferingFilter] = useState('all')
  const [offset, setOffset] = useState(0)

  // Get transaction results from store
  const { items: transactions, pending, error, total, hasMore } = useSelector(getMyTransactions)
  const loading = pending

  // Extract unique values for filter dropdowns
  const offerings = useMemo(() => {
    const offeringsMap = new Map()

    transactions.forEach(transaction => {
      if (transaction.offering?.id) {
        offeringsMap.set(transaction.offering.id, {
          id: transaction.offering.id,
          name: transaction.offeringName || transaction.offering.name
        })
      }
    })

    return Array.from(offeringsMap.values())
  }, [transactions])

  // Function to fetch transactions with current filters
  const fetchTransactions = useCallback(() => {
    const params = {
      first: 50,
      offset,
      status: statusFilter !== 'all' ? statusFilter : null,
      paymentType: paymentTypeFilter !== 'all' ? paymentTypeFilter : null,
      offeringId: offeringFilter !== 'all' ? offeringFilter : null
    }
    dispatch(fetchMyTransactions(params))
  }, [dispatch, statusFilter, paymentTypeFilter, offeringFilter, offset])

  const reconcileAfterMembershipChangeRef = useRef(null)

  /**
   * Re-fetch after a delay so the server (and Stripe webhooks) can catch up.
   * An immediate refetch would overwrite the optimistic store patch with stale data.
   */
  const scheduleReconcileAfterMembershipChange = useCallback(() => {
    if (reconcileAfterMembershipChangeRef.current != null) {
      clearTimeout(reconcileAfterMembershipChangeRef.current)
    }
    reconcileAfterMembershipChangeRef.current = window.setTimeout(() => {
      reconcileAfterMembershipChangeRef.current = null
      fetchTransactions()
    }, 8000)
  }, [fetchTransactions])

  /**
   * Deferred plan changes are already stored as pending subscription_change_events;
   * refetch immediately so the banner appears. Immediate swaps use optimistic UI + delayed refetch.
   */
  const handleMembershipChangeCommitted = useCallback((commitResult) => {
    if (membershipChangeDefersToPeriodEnd(commitResult?.mode)) {
      fetchTransactions()
      return
    }
    scheduleReconcileAfterMembershipChange()
  }, [fetchTransactions, scheduleReconcileAfterMembershipChange])

  useEffect(() => {
    return () => {
      if (reconcileAfterMembershipChangeRef.current != null) {
        clearTimeout(reconcileAfterMembershipChangeRef.current)
      }
    }
  }, [])

  // Fetch transactions when filters or offset change
  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0)
  }, [statusFilter, paymentTypeFilter, offeringFilter])

  // Set up view header
  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('My Transactions'),
      icon: <CreditCard />
    })
  }, [setHeaderDetails, t])

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setOffset(offset + 50)
    }
  }

  // Determine if filters are active
  const hasActiveFilters = statusFilter !== 'all' || paymentTypeFilter !== 'all' || offeringFilter !== 'all'

  // Determine if this is initial state (no transactions ever) vs filtered state (no results for current filters)
  const isInitialState = !loading && transactions.length === 0 && total === 0 && !hasActiveFilters

  if (error) {
    return (
      <div className='p-4 max-w-[750px] mx-auto mt-8'>
        <div className='text-center py-12 bg-destructive/10 rounded-lg border border-destructive/20'>
          <CreditCard className='w-12 h-12 mx-auto mb-4 text-destructive' />
          <h2 className='text-lg font-medium text-foreground mb-2'>
            {t('Error loading transactions')}
          </h2>
          <p className='text-muted-foreground'>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className='p-4 max-w-[750px] mx-auto flex flex-col gap-4 mt-4'>
      <p className='text-sm text-muted-foreground mb-2'>
        {t('Manage your purchases and subscriptions below.')}
      </p>

      {/* Filters */}
      <div className='bg-card p-4 rounded-md shadow-md'>
        <h3 className='text-sm font-semibold text-foreground mb-4'>{t('Filters')}</h3>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          {/* Status Filter */}
          <div className='space-y-2'>
            <Label htmlFor='filter-status' className='text-sm font-medium'>
              {t('Status')}
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id='filter-status' className={filterSelectTriggerClassName}>
                <SelectValue placeholder={t('All Status')} />
              </SelectTrigger>
              <SelectContent position='popper' className='z-[100]'>
                <SelectItem value='all'>{t('All Status')}</SelectItem>
                <SelectItem value='active'>{t('Active')}</SelectItem>
                <SelectItem value='expired'>{t('Expired')}</SelectItem>
                <SelectItem value='revoked'>{t('Revoked')}</SelectItem>
                <SelectItem value='refunded'>{t('Refunded')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Type Filter */}
          <div className='space-y-2'>
            <Label htmlFor='filter-payment-type' className='text-sm font-medium'>
              {t('Payment Type')}
            </Label>
            <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
              <SelectTrigger id='filter-payment-type' className={filterSelectTriggerClassName}>
                <SelectValue placeholder={t('All Types')} />
              </SelectTrigger>
              <SelectContent position='popper' className='z-[100]'>
                <SelectItem value='all'>{t('All Types')}</SelectItem>
                <SelectItem value='subscription'>{t('Subscription')}</SelectItem>
                <SelectItem value='one_time'>{t('One-time purchase')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Offering Filter - Show if we have offerings OR if we're in a filtered state */}
          {(offerings.length > 0 || hasActiveFilters) && (
            <div className='space-y-2'>
              <Label htmlFor='filter-offering' className='text-sm font-medium'>
                {t('Offering')}
              </Label>
              <Select
                value={offeringFilter === 'all' ? 'all' : String(offeringFilter)}
                onValueChange={(v) => setOfferingFilter(v === 'all' ? 'all' : v)}
              >
                <SelectTrigger id='filter-offering' className={filterSelectTriggerClassName}>
                  <SelectValue placeholder={t('All Offerings')} />
                </SelectTrigger>
                <SelectContent position='popper' className='z-[100] max-h-[min(60vh,20rem)]'>
                  <SelectItem value='all'>{t('All Offerings')}</SelectItem>
                  {offerings.map(offering => (
                    <SelectItem key={offering.id} value={String(offering.id)} className='whitespace-normal break-words'>
                      {offering.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Results Count with Loading Indicator */}
      <div className='flex items-center gap-2'>
        {total > 0 && (
          <div className='text-sm text-foreground/70'>
            {t('transactions.showingCountOfTotal', { count: transactions.length, total })}
          </div>
        )}
        {loading && (
          <div className='flex items-center gap-2 text-sm text-foreground/70'>
            <Loading />
            <span>{t('Loading...')}</span>
          </div>
        )}
      </div>

      {/* Transactions List */}
      {loading && transactions.length === 0 && (
        <div className='flex justify-center mt-8'>
          <Loading />
        </div>
      )}

      {!loading && transactions.length === 0 && (
        <div className='text-center py-12 px-5 sm:px-8 bg-card rounded-lg border border-border'>
          <CreditCard className='w-12 h-12 mx-auto mb-4 text-muted-foreground' />
          <h2 className='text-lg font-medium text-foreground mb-2'>
            {isInitialState ? t('No transactions yet') : t('No transactions found')}
          </h2>
          <p className='text-muted-foreground max-w-md mx-auto'>
            {isInitialState
              ? t('Your purchases and subscriptions will appear here.')
              : t('Try adjusting your filters to see more results.')}
          </p>
        </div>
      )}

      {transactions.length > 0 && (
        <div className='flex flex-col gap-4'>
          {transactions.map(transaction => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              t={t}
              onMembershipChangeCommitted={handleMembershipChangeCommitted}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className='flex justify-center mt-4'>
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className='px-6 py-2 bg-accent text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50'
          >
            {loading ? t('Loading...') : t('Load More')}
          </button>
        </div>
      )}
    </div>
  )
}

export default MyTransactions
