/* eslint-disable camelcase */

module.exports = bookshelf.Model.extend({
  tableName: 'content_access',
  requireFetch: false,
  hasTimestamps: true,

  /**
   * The user who has access
   */
  user: function () {
    return this.belongsTo(User, 'user_id')
  },

  /**
   * The group this access grant is for
   */
  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  /**
   * The Stripe product this access was granted for (optional - for paid access)
   */
  product: function () {
    return this.belongsTo(StripeProduct, 'product_id')
  },

  /**
   * Optional track that this access grant is for
   * If set, this grants access to a specific track within the group
   */
  track: function () {
    return this.belongsTo(Track, 'track_id')
  },

  /**
   * Optional role that this access grant is for
   * If set, this grants a specific role within the group
   */
  role: function () {
    return this.belongsTo(GroupRole, 'role_id')
  },

  /**
   * The admin who granted this access (for admin-granted free access)
   */
  grantedBy: function () {
    return this.belongsTo(User, 'granted_by_id')
  },

  /**
   * Check if this access has expired
   * @returns {Boolean}
   */
  isExpired: function () {
    const expiresAt = this.get('expires_at')
    return expiresAt && new Date(expiresAt) < new Date()
  },

  /**
   * Check if this access is currently active
   * @returns {Boolean}
   */
  isActive: function () {
    return this.get('status') === 'active' && !this.isExpired()
  }

}, {
  // Status constants
  Status: {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    REVOKED: 'revoked'
  },

  // Access type constants
  Type: {
    STRIPE_PURCHASE: 'stripe_purchase',
    ADMIN_GRANT: 'admin_grant'
  },

  /**
   * Create a new content access record
   * Note: The database triggers will automatically update related tables
   * (group_memberships, tracks_users, group_memberships_group_roles)
   *
   * @param {Object} attrs - Access attributes
   * @param {String|Number} attrs.user_id - User receiving access
   * @param {String|Number} attrs.group_id - Group the access is for
   * @param {String} attrs.access_type - Type: 'stripe_purchase', 'admin_grant', or 'free'
   * @param {String} [attrs.product_id] - Optional Stripe product ID
   * @param {String} [attrs.track_id] - Optional track ID
   * @param {String} [attrs.role_id] - Optional role ID
   * @param {Date} [attrs.expires_at] - Optional expiration date
   * @param {String} [attrs.stripe_session_id] - For Stripe purchases
   * @param {Number} [attrs.amount_paid] - Amount paid in cents
   * @param {String} [attrs.granted_by_id] - Admin who granted access
   * @param {Object} [attrs.metadata] - Additional metadata
   * @param {Object} options - Options including transacting
   * @returns {Promise<ContentAccess>}
   */
  create: async function (attrs, { transacting } = {}) {
    // Set defaults
    const defaults = {
      status: this.Status.ACTIVE,
      metadata: {}
    }

    // Filter out undefined values to prevent SQL errors
    const filteredAttrs = Object.entries(attrs).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value
      }
      return acc
    }, {})

    return this.forge({ ...defaults, ...filteredAttrs }).save({}, { transacting })
  },

  /**
   * Grant free access to content (admin action)
   * @param {Object} params
   * @param {String|Number} params.userId - User to grant access to
   * @param {String|Number} params.groupId - Group to grant access for
   * @param {String|Number} params.grantedById - Admin granting the access
   * @param {String|Number} [params.productId] - Optional product
   * @param {String|Number} [params.trackId] - Optional track
   * @param {String|Number} [params.roleId] - Optional role
   * @param {Date} [params.expiresAt] - Optional expiration
   * @param {String} [params.reason] - Reason for granting access (stored in metadata)
   * @param {Object} options - Options including transacting
   * @returns {Promise<ContentAccess>}
   */
  grantAccess: async function ({
    userId,
    groupId,
    grantedById,
    productId,
    trackId,
    roleId,
    expiresAt,
    reason
  }, { transacting } = {}) {
    const metadata = {}
    if (reason) metadata.reason = reason

    return this.create({
      user_id: userId,
      group_id: groupId,
      product_id: productId,
      track_id: trackId,
      role_id: roleId,
      access_type: this.Type.ADMIN_GRANT,
      granted_by_id: grantedById,
      expires_at: expiresAt,
      metadata
    }, { transacting })
  },

  /**
   * Record a Stripe purchase (called from webhook handler)
   * @param {Object} params
   * @param {String|Number} params.userId - User who made the purchase
   * @param {String|Number} params.groupId - Group the purchase is for
   * @param {String|Number} params.productId - Stripe product ID (from stripe_products table)
   * @param {String|Number} [params.trackId] - Optional track
   * @param {String|Number} [params.roleId] - Optional role
   * @param {String} params.sessionId - Stripe checkout session ID
   * @param {String} [params.paymentIntentId] - Stripe payment intent ID
   * @param {Date} [params.expiresAt] - When access expires
   * @param {Object} [params.metadata] - Additional metadata
   * @param {Object} options - Options including transacting
   * @returns {Promise<ContentAccess>}
   */
  recordPurchase: async function ({
    userId,
    groupId,
    productId,
    trackId,
    roleId,
    sessionId,
    paymentIntentId,
    expiresAt,
    metadata = {}
  }, { transacting } = {}) {
    return this.create({
      user_id: userId,
      group_id: groupId,
      product_id: productId,
      track_id: trackId,
      role_id: roleId,
      access_type: this.Type.STRIPE_PURCHASE,
      stripe_session_id: sessionId,
      stripe_payment_intent_id: paymentIntentId,
      expires_at: expiresAt,
      metadata
    }, { transacting })
  },

  /**
   * Revoke access (changes status to revoked)
   * Note: Database triggers will automatically clear expires_at in related tables
   *
   * @param {String|Number} accessId - The access record ID
   * @param {String|Number} revokedById - Admin who revoked the access
   * @param {String} [reason] - Reason for revocation
   * @param {Object} options - Options including transacting
   * @returns {Promise<ContentAccess>}
   */
  revoke: async function (accessId, revokedById, reason, { transacting } = {}) {
    const access = await this.where({ id: accessId }).fetch({ transacting })
    if (!access) {
      throw new Error('Access record not found')
    }

    const metadata = access.get('metadata') || {}
    metadata.revokedAt = new Date().toISOString()
    metadata.revokedBy = revokedById
    if (reason) metadata.revokeReason = reason

    return access.save({
      status: this.Status.REVOKED,
      metadata
    }, { transacting })
  },

  /**
   * Check if a user has active access to content
   * @param {Object} params
   * @param {String|Number} params.userId - User to check
   * @param {String|Number} params.groupId - Group to check
   * @param {String|Number} [params.productId] - Optional product
   * @param {String|Number} [params.trackId] - Optional track
   * @param {String|Number} [params.roleId] - Optional role
   * @returns {Promise<ContentAccess|null>}
   */
  checkAccess: async function ({ userId, groupId, productId, trackId, roleId }) {
    const query = this.where({
      user_id: userId,
      group_id: groupId,
      status: this.Status.ACTIVE
    })

    if (productId) query.where({ product_id: productId })
    if (trackId) query.where({ track_id: trackId })
    if (roleId) query.where({ role_id: roleId })

    const access = await query.fetch()

    // Check if expired
    if (access && access.isExpired()) {
      // Update status to expired
      await access.save({ status: this.Status.EXPIRED })
      return null
    }

    return access
  },

  /**
   * Get all active access records for a user in a group
   * @param {String|Number} userId
   * @param {String|Number} groupId
   * @returns {Promise<Collection<ContentAccess>>}
   */
  forUser: function (userId, groupId) {
    return this.where({
      user_id: userId,
      group_id: groupId,
      status: this.Status.ACTIVE
    }).fetchAll()
  },

  /**
   * Get all access records for a Stripe session
   * (useful for finding all access grants from a bundle purchase)
   * @param {String} sessionId - Stripe checkout session ID
   * @returns {Promise<Collection<ContentAccess>>}
   */
  forStripeSession: function (sessionId) {
    return this.where({ stripe_session_id: sessionId }).fetchAll()
  }
})
