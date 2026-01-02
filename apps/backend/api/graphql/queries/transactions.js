/**
 * User Transactions GraphQL Queries
 *
 * Provides GraphQL API for querying the current user's transactions/purchases.
 */

import { GraphQLError } from 'graphql'
import StripeService from '../../services/StripeService'

/* global ContentAccess, StripeAccount */

// Frontend URL for billing portal return
const FRONTEND_URL = process.env.PROTOCOL + '://' + process.env.DOMAIN

/**
 * Get the Stripe account external ID from a group
 *
 * The group.stripe_account_id is a foreign key to stripe_accounts.id
 * We need the stripe_account_external_id (acct_xxx) to make Stripe API calls
 *
 * @param {Object} group - Group bookshelf model
 * @returns {Promise<String|null>} Stripe account external ID or null
 */
async function getStripeAccountExternalId (group) {
  if (!group || !group.get) return null

  const stripeAccountId = group.get('stripe_account_id')
  if (!stripeAccountId) return null

  try {
    const stripeAccount = await StripeAccount.where({ id: stripeAccountId }).fetch()
    if (!stripeAccount) return null
    return stripeAccount.get('stripe_account_external_id') || null
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching stripe account:', err.message)
    }
    return null
  }
}

/**
 * Enrich a transaction item with Stripe data
 *
 * Fetches subscription/session details and generates billing portal URL.
 * Handles errors gracefully - returns partial data if Stripe calls fail.
 *
 * @param {Object} item - Transaction item to enrich
 * @returns {Promise<Object>} Enriched transaction item
 */
async function enrichWithStripeData (item) {
  const { _stripeAccountId, _stripeSubscriptionId, _stripeSessionId } = item

  // Skip if no Stripe account ID
  if (!_stripeAccountId) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Skipping Stripe enrichment - no Stripe account ID for transaction:', item.id)
    }
    return item
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('Enriching transaction:', item.id, {
      stripeAccountId: _stripeAccountId,
      subscriptionId: _stripeSubscriptionId,
      sessionId: _stripeSessionId
    })
  }

  try {
    // Get transaction details from Stripe
    const stripeData = await StripeService.getTransactionDetails(_stripeAccountId, {
      subscriptionId: _stripeSubscriptionId,
      sessionId: _stripeSessionId
    })

    if (stripeData) {
      item.subscriptionStatus = stripeData.subscriptionStatus
      item.currentPeriodEnd = stripeData.currentPeriodEnd
      item.amountPaid = stripeData.amountPaid
      item.currency = stripeData.currency
      item.receiptUrl = stripeData.receiptUrl

      // Generate billing portal URL if we have a customer ID
      if (stripeData.customerId) {
        try {
          const returnUrl = `${FRONTEND_URL}/my/transactions`
          const portalSession = await StripeService.createBillingPortalSession(
            _stripeAccountId,
            stripeData.customerId,
            returnUrl
          )
          item.manageUrl = portalSession.url
        } catch (portalError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error creating billing portal:', portalError.message)
          }
          // Continue without manage URL
        }
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error enriching transaction:', item.id, error.message)
    }
    // Continue with unenriched data
  }

  // Remove internal fields before returning
  delete item._stripeSessionId
  delete item._stripeSubscriptionId
  delete item._stripeAccountId

  return item
}

/**
 * Fetch all transactions/purchases for the current user
 *
 * Queries content_access records where the user made a Stripe purchase.
 * Returns transaction data enriched with offering and group information.
 *
 * @param {String|Number} userId - Current user ID
 * @param {Object} args - Query arguments
 * @param {Number} args.first - Number of records to return
 * @param {Number} args.offset - Pagination offset
 * @param {String} args.status - Filter by status: 'active', 'expired', 'cancelled'
 * @param {String} args.accessType - Filter by access type: 'group', 'track', 'role'
 * @returns {Promise<Object>} UserTransactionQuerySet
 */
export async function myTransactions (userId, { first = 20, offset = 0, status, accessType }) {
  if (!userId) {
    throw new GraphQLError('You must be logged in to view transactions')
  }

  try {
    // Build the query for user's purchases (only stripe_purchase, not admin_grant)
    const query = ContentAccess.query(q => {
      q.where('content_access.user_id', userId)
      q.where('content_access.access_type', 'stripe_purchase')

      // Filter by status if provided
      if (status) {
        q.where('content_access.status', status)
      }

      // Order by purchase date, newest first
      q.orderBy('content_access.created_at', 'desc')
    })

    // Get total count for pagination
    const countQuery = ContentAccess.query(q => {
      q.where('content_access.user_id', userId)
      q.where('content_access.access_type', 'stripe_purchase')
      if (status) {
        q.where('content_access.status', status)
      }
    })

    const totalResult = await countQuery.count()
    const total = parseInt(totalResult, 10)

    // Fetch the paginated results with related data
    const records = await query
      .query(q => {
        q.limit(first)
        q.offset(offset)
      })
      .fetchAll({
        withRelated: ['product', 'grantedByGroup', 'track', 'role']
      })

    // Transform records into UserTransaction format
    // We need to use Promise.all because we need to fetch Stripe account IDs asynchronously
    const baseItemPromises = records.models.map(async record => {
      const product = record.related('product')
      const group = record.related('grantedByGroup')
      const track = record.related('track')

      // Determine the access type based on what access was granted
      let derivedAccessType = 'group'
      if (record.get('track_id')) {
        derivedAccessType = 'track'
      } else if (record.get('role_id')) {
        derivedAccessType = 'role'
      } else if (record.get('group_id')) {
        derivedAccessType = 'group'
      }

      // Filter by accessType if provided
      if (accessType && derivedAccessType !== accessType) {
        return null
      }

      // Determine payment type based on stripe_subscription_id presence
      const paymentType = record.get('stripe_subscription_id') ? 'subscription' : 'one_time'

      // Get the actual Stripe account external ID (acct_xxx) for API calls
      const stripeAccountExternalId = await getStripeAccountExternalId(group)

      return {
        id: record.get('id'),

        // From our database
        offering: product && product.id ? product : null,
        offeringName: product && product.get ? product.get('name') : null,
        group,
        groupName: group && group.get ? group.get('name') : null,
        track: track && track.id ? track : null,
        trackName: track && track.get ? track.get('name') : null,
        accessType: derivedAccessType,
        status: record.get('status'),
        purchaseDate: record.get('created_at'),
        expiresAt: record.get('expires_at'),

        // Payment type
        paymentType,

        // Stripe data placeholders - will be enriched below
        subscriptionStatus: null,
        currentPeriodEnd: null,
        amountPaid: null,
        currency: null,
        manageUrl: null,
        receiptUrl: null,

        // Store Stripe IDs for enrichment (use external ID, not FK)
        _stripeSessionId: record.get('stripe_session_id'),
        _stripeSubscriptionId: record.get('stripe_subscription_id'),
        _stripeAccountId: stripeAccountExternalId
      }
    })

    const baseItems = (await Promise.all(baseItemPromises)).filter(Boolean) // Remove null entries from accessType filtering

    // Enrich items with Stripe data in parallel
    const items = await Promise.all(baseItems.map(enrichWithStripeData))

    // Recalculate hasMore after filtering
    const hasMore = offset + items.length < total

    return {
      total,
      hasMore,
      items
    }
  } catch (error) {
    if (error instanceof GraphQLError) {
      throw error
    }
    console.error('Error in myTransactions:', error)
    throw new GraphQLError(`Failed to fetch transactions: ${error.message}`)
  }
}
