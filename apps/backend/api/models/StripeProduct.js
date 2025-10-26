/* eslint-disable camelcase */

module.exports = bookshelf.Model.extend({
  tableName: 'stripe_products',
  requireFetch: false,
  hasTimestamps: true,

  /**
   * The group that this Stripe product belongs to
   */
  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  /**
   * Optional track that this product grants access to
   * If set, purchasing this product grants access to the specific track
   */
  track: function () {
    return this.belongsTo(Track, 'track_id')
  },

  /**
   * All content access records associated with this product
   * (can be multiple users who purchased this product, or multiple access grants from a bundle)
   */
  contentAccess: function () {
    // Note: ContentAccess is globally available after models are loaded
    return this.hasMany('ContentAccess', 'product_id')
  }

}, {
  /**
   * Create a new Stripe product record
   * @param {Object} attrs - Product attributes (stripe_product_id, stripe_price_id, name, price_in_cents, etc.)
   * @param {Object} attrs.content_access - JSONB object defining what access this product grants
   * @param {Object} options - Options including transacting
   * @returns {Promise<StripeProduct>}
   */
  create: async function (attrs, { transacting } = {}) {
    // Set default values if not provided
    const defaults = {
      content_access: {},
      renewal_policy: 'manual',
      duration: null,
      publish_status: 'unpublished'
    }
    return this.forge({ ...defaults, ...attrs }).save({}, { transacting })
  },

  /**
   * Find a product by its Stripe product ID
   * @param {String} stripeProductId - The Stripe product ID
   * @returns {Promise<StripeProduct|null>}
   */
  findByStripeId: function (stripeProductId) {
    return this.where({ stripe_product_id: stripeProductId }).fetch()
  },

  /**
   * Get all published products for a group (excludes unpublished, unlisted, and archived)
   * @param {String|Number} groupId - The group ID
   * @returns {Promise<Collection<StripeProduct>>}
   */
  forGroup: function (groupId) {
    return this.where({ group_id: groupId, publish_status: 'published' }).fetchAll()
  },

  /**
   * Get all published products for a specific track (excludes unpublished, unlisted, and archived)
   * @param {String|Number} trackId - The track ID
   * @returns {Promise<Collection<StripeProduct>>}
   */
  forTrack: function (trackId) {
    return this.where({ track_id: trackId, publish_status: 'published' }).fetchAll()
  },

  /**
   * Update a Stripe product
   * @param {String|Number} productId - The product ID
   * @param {Object} attrs - Attributes to update
   * @param {Object} options - Options including transacting
   * @returns {Promise<StripeProduct>}
   */
  update: async function (productId, attrs, { transacting } = {}) {
    const product = await this.find(productId)
    if (!product) {
      throw new Error('Product not found')
    }

    // Update the product with new attributes
    return product.save(attrs, { transacting })
  },

  /**
   * Generate content access records from product definition
   *
   * Takes the content_access JSONB field and creates individual content_access records
   * for each group/track/role combination defined in the product.
   *
   * @param {Object} params
   * @param {String|Number} params.userId - User who purchased the product
   * @param {String} params.sessionId - Stripe checkout session ID
   * @param {String} [params.paymentIntentId] - Stripe payment intent ID
   * @param {Date} [params.expiresAt] - When access expires
   * @param {Object} [params.metadata] - Additional metadata
   * @param {Object} options - Options including transacting
   * @returns {Promise<Array<ContentAccess>>} Array of created content access records
   */
  generateContentAccessRecords: async function ({
    userId,
    sessionId,
    paymentIntentId,
    expiresAt,
    metadata = {}
  }, { transacting } = {}) {
    const contentAccess = this.get('content_access') || {}
    const groupId = this.get('group_id')
    const productId = this.get('id')
    const duration = this.get('duration')
    const accessRecords = []

    // Calculate expiration date if not provided
    const calculatedExpiresAt = expiresAt || this.calculateExpirationDate(duration)

    // If content_access is empty, grant basic group access
    if (Object.keys(contentAccess).length === 0) {
      const record = await ContentAccess.recordPurchase({
        userId,
        groupId,
        productId,
        sessionId,
        paymentIntentId,
        expiresAt: calculatedExpiresAt,
        metadata
      }, { transacting })
      accessRecords.push(record)
      return accessRecords
    }

    // Process each group in the content_access definition
    for (const [groupIdStr, groupAccess] of Object.entries(contentAccess)) {
      const groupIdNum = parseInt(groupIdStr, 10)

      // Create base group access record
      const baseRecord = await ContentAccess.recordPurchase({
        userId,
        groupId: groupIdNum,
        productId,
        sessionId,
        paymentIntentId,
        expiresAt: calculatedExpiresAt,
        metadata: {
          ...metadata,
          accessType: 'group'
        }
      }, { transacting })
      accessRecords.push(baseRecord)

      // Add track-specific access records
      if (groupAccess.trackIds && Array.isArray(groupAccess.trackIds)) {
        for (const trackId of groupAccess.trackIds) {
          const trackRecord = await ContentAccess.recordPurchase({
            userId,
            groupId: groupIdNum,
            productId,
            trackId,
            sessionId,
            paymentIntentId,
            expiresAt: calculatedExpiresAt,
            metadata: {
              ...metadata,
              accessType: 'track'
            }
          }, { transacting })
          accessRecords.push(trackRecord)
        }
      }

      // Add role-specific access records
      if (groupAccess.roleIds && Array.isArray(groupAccess.roleIds)) {
        for (const roleId of groupAccess.roleIds) {
          const roleRecord = await ContentAccess.recordPurchase({
            userId,
            groupId: groupIdNum,
            productId,
            roleId,
            sessionId,
            paymentIntentId,
            expiresAt: calculatedExpiresAt,
            metadata: {
              ...metadata,
              accessType: 'role'
            }
          }, { transacting })
          accessRecords.push(roleRecord)
        }
      }
    }

    return accessRecords
  },

  // Renewal policy constants
  RenewalPolicy: {
    AUTOMATIC: 'automatic',
    MANUAL: 'manual'
  },

  // Duration constants
  Duration: {
    MONTH: 'month',
    SEASON: 'season',
    ANNUAL: 'annual',
    LIFETIME: 'lifetime'
  },

  // Publish status constants
  PublishStatus: {
    UNPUBLISHED: 'unpublished',
    UNLISTED: 'unlisted',
    PUBLISHED: 'published',
    ARCHIVED: 'archived'
  },

  /**
   * Calculate expiration date based on duration
   * @param {String} duration - Duration string (month, season, annual, lifetime, or null)
   * @param {Date} [startDate] - Start date for calculation (defaults to now)
   * @returns {Date|null} Expiration date or null for lifetime/no expiration
   */
  calculateExpirationDate: function (duration, startDate = new Date()) {
    if (!duration) {
      return null // No expiration (lifetime or tracks)
    }

    const start = new Date(startDate)

    switch (duration) {
      case this.Duration.MONTH:
        return new Date(start.getTime() + (30 * 24 * 60 * 60 * 1000)) // 30 days

      case this.Duration.SEASON:
        return new Date(start.getTime() + (90 * 24 * 60 * 60 * 1000)) // 90 days

      case this.Duration.ANNUAL:
        return new Date(start.getTime() + (365 * 24 * 60 * 60 * 1000)) // 365 days

      case this.Duration.LIFETIME:
        return null // No expiration

      default:
        return null // Unknown duration, no expiration
    }
  }
})
