/**
 * OfferingStatsService
 *
 * Provides methods for calculating subscription statistics for offerings (StripeProducts).
 * Handles active/lapsed subscriber counts and paginated subscriber lists.
 *
 * Revenue calculations require Stripe API integration (see StripeService).
 */

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
  }
}

