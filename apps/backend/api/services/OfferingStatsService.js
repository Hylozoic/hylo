/**
 * OfferingStatsService
 *
 * Provides methods for calculating subscription statistics for offerings (StripeProducts).
 * Handles active/lapsed subscriber counts and paginated subscriber lists.
 *
 * Revenue calculations require Stripe API integration (see StripeService).
 */

/* global bookshelf, StripeProduct, Group, StripeAccount */

const StripeService = require('./StripeService')

module.exports = {
  /**
   * Get subscription stats for an offering (StripeProduct)
   *
   * @param {String|Number} productId - The StripeProduct ID
   * @returns {Promise<Object>} - { activeCount, lapsedCount }
   */
  async getSubscriptionStats (productId) {
    const activeCount = await this.getActiveSubscriberCount(productId)
    const lapsedCount = await this.getLapsedSubscriberCount(productId)

    return {
      activeCount,
      lapsedCount
    }
  },

  /**
   * Get count of currently active subscribers for an offering
   *
   * @param {String|Number} productId - The StripeProduct ID
   * @returns {Promise<Number>} - Count of active subscribers
   */
  async getActiveSubscriberCount (productId) {
    const result = await bookshelf.knex('content_access')
      .where({ product_id: productId, status: 'active' })
      .andWhere(function () {
        this.whereNull('expires_at').orWhere('expires_at', '>', new Date())
      })
      .count('* as count')
      .first()

    return parseInt(result.count, 10) || 0
  },

  /**
   * Get count of lapsed (expired/revoked) subscribers for an offering
   *
   * @param {String|Number} productId - The StripeProduct ID
   * @returns {Promise<Number>} - Count of lapsed subscribers
   */
  async getLapsedSubscriberCount (productId) {
    const result = await bookshelf.knex('content_access')
      .where({ product_id: productId })
      .andWhere(function () {
        this.whereIn('status', ['expired', 'revoked'])
          .orWhere(function () {
            this.where('status', 'active').andWhere('expires_at', '<', new Date())
          })
      })
      .count('* as count')
      .first()

    return parseInt(result.count, 10) || 0
  },

  /**
   * Get paginated list of subscribers for an offering
   *
   * @param {String|Number} productId - The StripeProduct ID
   * @param {Object} options - Pagination and filter options
   * @param {Number} [options.page=1] - Page number (1-indexed)
   * @param {Number} [options.pageSize=50] - Number of results per page
   * @param {Boolean} [options.lapsedOnly=false] - If true, only return lapsed subscribers
   * @returns {Promise<Object>} - { subscribers: Array, total: Number, page: Number, pageSize: Number, totalPages: Number }
   */
  async getSubscribers (productId, { page = 1, pageSize = 50, lapsedOnly = false } = {}) {
    const offset = (page - 1) * pageSize

    // Build base query
    let query = bookshelf.knex('content_access')
      .where({ product_id: productId })

    // Apply filter for lapsed or active
    if (lapsedOnly) {
      query = query.andWhere(function () {
        this.whereIn('status', ['expired', 'revoked'])
          .orWhere(function () {
            this.where('status', 'active').andWhere('expires_at', '<', new Date())
          })
      })
    }

    // Get total count first
    const countResult = await query.clone().count('* as count').first()
    const total = parseInt(countResult.count, 10) || 0

    // Get paginated results with user data
    const rows = await query.clone()
      .select([
        'content_access.id',
        'content_access.user_id',
        'content_access.status',
        'content_access.expires_at',
        'content_access.created_at',
        'content_access.stripe_subscription_id',
        'users.name as user_name',
        'users.avatar_url as user_avatar_url'
      ])
      .join('users', 'content_access.user_id', 'users.id')
      .orderBy('content_access.created_at', 'desc')
      .limit(pageSize)
      .offset(offset)

    // Transform rows into subscriber objects
    const subscribers = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userAvatarUrl: row.user_avatar_url,
      status: this.determineSubscriberStatus(row),
      joinedAt: row.created_at,
      expiresAt: row.expires_at,
      stripeSubscriptionId: row.stripe_subscription_id
    }))

    return {
      subscribers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  },

  /**
   * Determine the effective status of a subscriber
   * Handles the case where status is 'active' but expires_at has passed
   *
   * @param {Object} row - Database row with status and expires_at
   * @returns {String} - 'active' or 'lapsed'
   */
  determineSubscriberStatus (row) {
    if (row.status === 'active') {
      // Check if expired
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        return 'lapsed'
      }
      return 'active'
    }
    // status is 'expired' or 'revoked'
    return 'lapsed'
  },

  /**
   * Get all active subscribers for an offering (no pagination)
   * Useful for smaller offerings or export functionality
   *
   * @param {String|Number} productId - The StripeProduct ID
   * @returns {Promise<Array>} - Array of subscriber objects
   */
  async getAllActiveSubscribers (productId) {
    const rows = await bookshelf.knex('content_access')
      .where({ product_id: productId, status: 'active' })
      .andWhere(function () {
        this.whereNull('expires_at').orWhere('expires_at', '>', new Date())
      })
      .select([
        'content_access.id',
        'content_access.user_id',
        'content_access.stripe_subscription_id',
        'content_access.created_at',
        'content_access.expires_at'
      ])
      .join('users', 'content_access.user_id', 'users.id')
      .select([
        'users.name as user_name',
        'users.avatar_url as user_avatar_url'
      ])

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userAvatarUrl: row.user_avatar_url,
      stripeSubscriptionId: row.stripe_subscription_id,
      joinedAt: row.created_at,
      expiresAt: row.expires_at
    }))
  },

  /**
   * Get Stripe subscription IDs for an offering's active subscribers
   * Useful for calculating revenue from Stripe API
   *
   * @param {String|Number} productId - The StripeProduct ID
   * @returns {Promise<Array<String>>} - Array of Stripe subscription IDs (excludes nulls)
   */
  async getActiveStripeSubscriptionIds (productId) {
    const rows = await bookshelf.knex('content_access')
      .where({ product_id: productId, status: 'active' })
      .whereNotNull('stripe_subscription_id')
      .andWhere(function () {
        this.whereNull('expires_at').orWhere('expires_at', '>', new Date())
      })
      .select('stripe_subscription_id')
      .distinct()

    return rows.map(row => row.stripe_subscription_id)
  },

  /**
   * Calculate monthly revenue for an offering
   *
   * For subscription offerings (renewal_policy = 'automatic'):
   *   Fetches active subscriptions from Stripe and normalizes to monthly revenue.
   *
   * For one-time payment offerings (renewal_policy = 'manual'):
   *   Calculates the sum of purchases from the last 30 days based on content_access records.
   *
   * @param {String|Number} productId - The StripeProduct ID
   * @returns {Promise<Object>} - { monthlyRevenueCents: Number, currency: String }
   */
  async calculateMonthlyRevenue (productId) {
    // Get the offering to find the group, price, and duration
    const offering = await StripeProduct.where({ id: productId }).fetch()
    if (!offering) {
      return { monthlyRevenueCents: 0, currency: 'usd' }
    }

    const duration = offering.get('duration')

    // Check if this is a subscription offering (has a recurring duration)
    const isSubscription = ['annual', 'month', 'season'].includes(duration)

    // For one-time payments (no duration/lifetime), calculate from last 30 days of purchases
    if (!isSubscription) {
      return this.calculateOneTimePaymentRevenue(productId, offering)
    }

    // For subscriptions, calculate from active Stripe subscriptions
    return this.calculateSubscriptionRevenue(productId, offering)
  },

  /**
   * Calculate revenue from one-time payment purchases in the last 30 days
   *
   * Uses content_access records to count purchases and multiplies by the offering price.
   * Note: If the price has changed, this reflects the current price, not the historical purchase price.
   *
   * @param {String|Number} productId - The StripeProduct ID
   * @param {Object} offering - The StripeProduct model instance
   * @returns {Promise<Object>} - { monthlyRevenueCents: Number, currency: String }
   */
  async calculateOneTimePaymentRevenue (productId, offering) {
    const currency = offering.get('currency') || 'usd'
    const priceInCents = offering.get('price_in_cents') || 0

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Count purchases in the last 30 days
    const result = await bookshelf.knex('content_access')
      .where({ product_id: productId })
      .where('created_at', '>=', thirtyDaysAgo)
      .whereNull('stripe_subscription_id') // One-time payments don't have subscription IDs
      .count('* as count')
      .first()

    const purchaseCount = parseInt(result.count, 10) || 0
    const monthlyRevenueCents = purchaseCount * priceInCents

    return {
      monthlyRevenueCents,
      currency
    }
  },

  /**
   * Calculate monthly revenue from active Stripe subscriptions
   *
   * Fetches active subscriptions from Stripe in a single API call and calculates
   * the normalized monthly revenue by converting all billing intervals to monthly equivalents.
   *
   * @param {String|Number} productId - The StripeProduct ID
   * @param {Object} offering - The StripeProduct model instance
   * @returns {Promise<Object>} - { monthlyRevenueCents: Number, currency: String }
   */
  async calculateSubscriptionRevenue (productId, offering) {
    const groupId = offering.get('group_id')
    const currency = offering.get('currency') || 'usd'
    const stripePriceId = offering.get('stripe_price_id')

    // If no Stripe price ID, can't fetch from Stripe
    if (!stripePriceId) {
      return { monthlyRevenueCents: 0, currency }
    }

    // Get the group to find the Stripe account
    const group = await Group.where({ id: groupId }).fetch()
    if (!group) {
      return { monthlyRevenueCents: 0, currency }
    }

    const stripeAccountId = group.get('stripe_account_id')
    if (!stripeAccountId) {
      return { monthlyRevenueCents: 0, currency }
    }

    // Get the external account ID
    const stripeAccount = await StripeAccount.where({ id: stripeAccountId }).fetch()
    if (!stripeAccount) {
      return { monthlyRevenueCents: 0, currency }
    }

    const externalAccountId = stripeAccount.get('stripe_account_external_id')
    if (!externalAccountId) {
      return { monthlyRevenueCents: 0, currency }
    }

    // Fetch all active subscriptions for this price in one API call
    const subscriptions = await StripeService.listSubscriptionsByPrice(
      externalAccountId,
      stripePriceId,
      { status: 'active' }
    )

    if (subscriptions.length === 0) {
      return { monthlyRevenueCents: 0, currency }
    }

    // Calculate monthly revenue from subscriptions
    let monthlyRevenueCents = 0

    for (const subscription of subscriptions) {
      // Process each subscription item (usually just one)
      for (const item of subscription.items.data) {
        const price = item.price
        if (!price || !price.unit_amount) continue

        const amountCents = price.unit_amount
        const interval = price.recurring?.interval
        const intervalCount = price.recurring?.interval_count || 1

        // Normalize to monthly revenue
        const monthlyAmount = this.normalizeToMonthly(amountCents, interval, intervalCount)
        monthlyRevenueCents += monthlyAmount
      }
    }

    return {
      monthlyRevenueCents: Math.round(monthlyRevenueCents),
      currency
    }
  },

  /**
   * Normalize a subscription amount to monthly revenue
   *
   * @param {Number} amountCents - The subscription amount in cents
   * @param {String} interval - The billing interval: 'day', 'week', 'month', 'year'
   * @param {Number} intervalCount - Number of intervals between billings
   * @returns {Number} - Monthly equivalent in cents
   */
  normalizeToMonthly (amountCents, interval, intervalCount = 1) {
    if (!interval || !amountCents) {
      return 0
    }

    // Calculate months per billing cycle
    let monthsPerCycle
    switch (interval) {
      case 'day':
        // Approximate: 30.44 days per month
        monthsPerCycle = (intervalCount / 30.44)
        break
      case 'week':
        // Approximate: 4.35 weeks per month
        monthsPerCycle = (intervalCount / 4.35)
        break
      case 'month':
        monthsPerCycle = intervalCount
        break
      case 'year':
        monthsPerCycle = intervalCount * 12
        break
      default:
        return 0
    }

    // Monthly revenue = amount / months per billing cycle
    return amountCents / monthsPerCycle
  }
}
