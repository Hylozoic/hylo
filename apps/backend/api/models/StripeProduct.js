/* eslint-disable camelcase */
/* global Track */

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
    return this.hasMany(ContentAccess, 'product_id')
  },

  /**
   * Generate content access records from product definition
   *
   * Takes the access_grants JSONB field and creates individual content_access table records
   * for each group/track/role combination defined in the product.
   *
   * @param {Object} params
   * @param {String|Number} params.userId - User who purchased the product
   * @param {String} params.sessionId - Stripe checkout session ID
   * @param {String} [params.stripeSubscriptionId] - Stripe subscription ID (recurring purchases)
   * @param {Date} [params.expiresAt] - When access expires
   * @param {Object} [params.metadata] - Additional metadata
   * @param {Object} options - Options including transacting
   * @returns {Promise<Array<ContentAccess>>} Array of created content access records
   */
  generateContentAccessRecords: async function ({
    userId,
    sessionId,
    stripeSubscriptionId,
    expiresAt,
    metadata = {}
  }, { transacting } = {}) {
    const accessGrants = this.get('access_grants') || {}
    const grantedByGroupId = this.get('group_id') // The group that owns/sells this product
    const productId = this.get('id')
    const duration = this.get('duration')
    const accessRecords = []

    // Ensure all IDs are integers (database expects bigint/integer types)
    const userIdNum = parseInt(userId, 10)
    const grantedByGroupIdNum = parseInt(grantedByGroupId, 10)
    const productIdNum = parseInt(productId, 10)

    // Validate required IDs
    if (isNaN(userIdNum) || userIdNum <= 0) {
      throw new Error(`Invalid userId: ${userId}`)
    }
    if (isNaN(grantedByGroupIdNum) || grantedByGroupIdNum <= 0) {
      throw new Error(`Invalid grantedByGroupId: ${grantedByGroupId}`)
    }
    if (isNaN(productIdNum) || productIdNum <= 0) {
      throw new Error(`Invalid productId: ${productId}`)
    }

    // Calculate expiration date if not provided
    const calculatedExpiresAt = expiresAt || this.calculateExpirationDate(duration)

    // If access_grants is empty, grant basic group access
    if (Object.keys(accessGrants).length === 0) {
      const record = await ContentAccess.recordPurchase({
        userId: userIdNum,
        grantedByGroupId: grantedByGroupIdNum,
        productId: productIdNum,
        sessionId,
        stripeSubscriptionId,
        expiresAt: calculatedExpiresAt,
        metadata
      }, { transacting })
      accessRecords.push(record)
      return accessRecords
    }

    // Process access_grants structure: { groupIds: [123, 456], trackIds: [1, 2], roleIds: [3] }
    // Handle groupIds - create group access records
    if (accessGrants.groupIds && Array.isArray(accessGrants.groupIds)) {
      for (const groupId of accessGrants.groupIds) {
        const groupIdNum = parseInt(groupId, 10)
        if (isNaN(groupIdNum) || groupIdNum <= 0) {
          console.warn(`Invalid groupId in access_grants.groupIds: ${groupId}, skipping`)
          continue
        }

        // Create base group access record
        const baseRecord = await ContentAccess.recordPurchase({
          userId: userIdNum,
          grantedByGroupId: grantedByGroupIdNum,
          groupId: groupIdNum,
          productId: productIdNum,
          sessionId,
          stripeSubscriptionId,
          expiresAt: calculatedExpiresAt,
          metadata: {
            ...metadata,
            accessType: 'group'
          }
        }, { transacting })
        accessRecords.push(baseRecord)
      }
    }

    // Handle trackIds - create track access records (applies to all groups in groupIds, or grantedByGroupId if no groupIds)
    if (accessGrants.trackIds && Array.isArray(accessGrants.trackIds)) {
      const groupIdsForTracks = accessGrants.groupIds && Array.isArray(accessGrants.groupIds) && accessGrants.groupIds.length > 0
        ? accessGrants.groupIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0)
        : [grantedByGroupIdNum] // Default to the group that owns the product

      for (const groupIdNum of groupIdsForTracks) {
        for (const trackId of accessGrants.trackIds) {
          // Convert trackId to integer or null
          const trackIdNum = trackId != null ? parseInt(trackId, 10) : null
          if (trackId != null && (isNaN(trackIdNum) || trackIdNum <= 0)) {
            console.warn(`Invalid trackId: ${trackId}, skipping`)
            continue
          }

          const trackRecord = await ContentAccess.recordPurchase({
            userId: userIdNum,
            grantedByGroupId: grantedByGroupIdNum,
            groupId: groupIdNum,
            productId: productIdNum,
            trackId: trackIdNum,
            sessionId,
            stripeSubscriptionId,
            expiresAt: calculatedExpiresAt,
            metadata: {
              ...metadata,
              accessType: 'track'
            }
          }, { transacting })
          accessRecords.push(trackRecord)

          // Auto-enroll user in track when access is granted
          try {
            await Track.enroll(trackIdNum, userIdNum)
          } catch (enrollError) {
            // Log but don't fail the purchase if enrollment fails
            console.warn(`Auto-enrollment in track ${trackIdNum} failed for user ${userIdNum}:`, enrollError.message)
          }
        }
      }
    }

    // Handle roleIds - create role access records (applies to all groups in groupIds, or grantedByGroupId if no groupIds)
    if (accessGrants.roleIds && Array.isArray(accessGrants.roleIds)) {
      const groupIdsForRoles = accessGrants.groupIds && Array.isArray(accessGrants.groupIds) && accessGrants.groupIds.length > 0
        ? accessGrants.groupIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0)
        : [grantedByGroupIdNum] // Default to the group that owns the product

      for (const groupIdNum of groupIdsForRoles) {
        for (const roleId of accessGrants.roleIds) {
          // Convert roleId to integer or null
          const roleIdNum = roleId != null ? parseInt(roleId, 10) : null
          if (roleId != null && (isNaN(roleIdNum) || roleIdNum <= 0)) {
            console.warn(`Invalid roleId: ${roleId}, skipping`)
            continue
          }

          const roleRecord = await ContentAccess.recordPurchase({
            userId: userIdNum,
            grantedByGroupId: grantedByGroupIdNum,
            groupId: groupIdNum,
            productId: productIdNum,
            roleId: roleIdNum,
            sessionId,
            stripeSubscriptionId,
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

    // Use string literals to match Duration constants
    switch (duration) {
      case 'month':
        return new Date(start.getTime() + (30 * 24 * 60 * 60 * 1000)) // 30 days

      case 'season':
        return new Date(start.getTime() + (90 * 24 * 60 * 60 * 1000)) // 90 days

      case 'annual':
        return new Date(start.getTime() + (365 * 24 * 60 * 60 * 1000)) // 365 days

      case 'lifetime':
        return null // No expiration

      default:
        return null // Unknown duration, no expiration
    }
  }

}, {
  /**
   * Create a new Stripe product record
   * @param {Object} attrs - Product attributes (stripe_product_id, stripe_price_id, name, price_in_cents, etc.)
   * @param {Object} attrs.access_grants - JSONB object defining what access this product grants
   * @param {Object} options - Options including transacting
   * @returns {Promise<StripeProduct>}
   */
  create: async function (attrs, { transacting } = {}) {
    // Set default values if not provided
    const defaults = {
      access_grants: {},
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
  }
})
