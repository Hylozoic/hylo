/**
 * MyTransactions component
 *
 * Displays a list of the user's purchases and subscriptions.
 * Allows users to manage their subscriptions via Stripe billing portal.
 */

import { CreditCard, ExternalLink } from 'lucide-react'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Loading from 'components/Loading'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchMyTransactions from 'store/actions/fetchMyTransactions'
import { getMyTransactions } from 'store/reducers/myTransactions'

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
 * Transaction card component
 */
function TransactionCard ({ transaction, t }) {
  const {
    offeringName,
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
    receiptUrl
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

        {/* Amount */}
        {amountPaid && (
          <>
            <div className='text-muted-foreground'>{t('Amount')}:</div>
            <div className='text-foreground font-medium'>
              {formatPrice(amountPaid, currency)}
              {paymentType === 'subscription' && <span className='text-muted-foreground font-normal'> / {t('month')}</span>}
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

      {/* Stripe Action */}
      {stripeActionUrl && (
        <div className='pt-2 border-t border-border'>
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
        </div>
      )}
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

  if (loading) {
    return (
      <div className='p-4 max-w-[750px] mx-auto flex justify-center mt-8'>
        <Loading />
      </div>
    )
  }

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

  if (transactions.length === 0) {
    return (
      <div className='p-4 max-w-[750px] mx-auto mt-8'>
        <div className='text-center py-12 bg-card rounded-lg border border-border'>
          <CreditCard className='w-12 h-12 mx-auto mb-4 text-muted-foreground' />
          <h2 className='text-lg font-medium text-foreground mb-2'>
            {t('No transactions yet')}
          </h2>
          <p className='text-muted-foreground'>
            {t('Your purchases and subscriptions will appear here.')}
          </p>
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
          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              {t('Status')}
            </label>
            <select
              className='w-full px-3 py-2 bg-input border border-foreground/20 rounded-md text-foreground focus:border-focus focus:outline-none'
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value='all'>{t('All Status')}</option>
              <option value='active'>{t('Active')}</option>
              <option value='expired'>{t('Expired')}</option>
              <option value='revoked'>{t('Revoked')}</option>
              <option value='refunded'>{t('Refunded')}</option>
            </select>
          </div>

          {/* Payment Type Filter */}
          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              {t('Payment Type')}
            </label>
            <select
              className='w-full px-3 py-2 bg-input border border-foreground/20 rounded-md text-foreground focus:border-focus focus:outline-none'
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
            >
              <option value='all'>{t('All Types')}</option>
              <option value='subscription'>{t('Subscription')}</option>
              <option value='one_time'>{t('One-time purchase')}</option>
            </select>
          </div>

          {/* Offering Filter */}
          {offerings.length > 0 && (
            <div>
              <label className='block text-sm font-medium text-foreground mb-2'>
                {t('Offering')}
              </label>
              <select
                className='w-full px-3 py-2 bg-input border border-foreground/20 rounded-md text-foreground focus:border-focus focus:outline-none'
                value={offeringFilter}
                onChange={(e) => setOfferingFilter(e.target.value)}
              >
                <option value='all'>{t('All Offerings')}</option>
                {offerings.map(offering => (
                  <option key={offering.id} value={offering.id}>
                    {offering.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Results Count */}
      {total > 0 && (
        <div className='text-sm text-foreground/70'>
          {t('Showing {{count}} of {{total}} transactions', { count: transactions.length, total })}
        </div>
      )}

      {/* Transactions List */}
      {loading && transactions.length === 0 && (
        <div className='flex justify-center mt-8'>
          <Loading />
        </div>
      )}

      {!loading && transactions.length === 0 && (
        <div className='text-center py-12 bg-card rounded-lg border border-border'>
          <CreditCard className='w-12 h-12 mx-auto mb-4 text-muted-foreground' />
          <h2 className='text-lg font-medium text-foreground mb-2'>
            {t('No transactions found')}
          </h2>
          <p className='text-muted-foreground'>
            {t('Try adjusting your filters to see more results.')}
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
