/* eslint-disable camelcase */
const { createTrackScope, createGroupRoleScope, createCommonRoleScope, createGroupScope } = require('../../lib/scopes')
const StripeService = require('../services/StripeService')

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
   * The group that grants this access
   * Required - this is the group administering the access grant
   */
  grantedByGroup: function () {
    return this.belongsTo(Group, 'granted_by_group_id')
  },

  /**
   * The group this access grant is for (optional)
   * Can be null for system-level or cross-group grants
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
   * Optional group role that this access grant is for
   * If set, this grants a specific group role within the group
   */
  groupRole: function () {
    return this.belongsTo(GroupRole, 'group_role_id')
  },

  /**
   * Optional common role that this access grant is for
   * If set, this grants a specific common role within the group
   */
  commonRole: function () {
    return this.belongsTo(CommonRole, 'common_role_id')
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
  },

  /**
   * Get the scope string that this content access grants
   * Note: Each content_access record grants exactly ONE scope - either a track, role, or group scope
   * @returns {String|null} Single scope string (e.g., 'group:123', 'track:456', 'group_role:123:789', 'common_role:123:1')
   */
  getScope: function () {
    const trackId = this.get('track_id')
    const groupRoleId = this.get('group_role_id')
    const commonRoleId = this.get('common_role_id')
    const groupId = this.get('group_id')
    const grantedByGroupId = this.get('granted_by_group_id')

    // Each content_access record should only have one of these set
    if (trackId) {
      return createTrackScope(trackId)
    } else if (groupRoleId) {
      // Use group_id if available, otherwise fall back to granted_by_group_id
      const scopeGroupId = groupId || grantedByGroupId
      if (!scopeGroupId) {
        console.warn('Cannot create group role scope: missing group_id and granted_by_group_id')
        return null
      }
      return createGroupRoleScope(groupRoleId, scopeGroupId)
    } else if (commonRoleId) {
      // Use group_id if available, otherwise fall back to granted_by_group_id
      const scopeGroupId = groupId || grantedByGroupId
      if (!scopeGroupId) {
        console.warn('Cannot create common role scope: missing group_id and granted_by_group_id')
        return null
      }
      return createCommonRoleScope(commonRoleId, scopeGroupId)
    } else if (groupId) {
      return createGroupScope(groupId)
    }

    return null
  }

}, {
  // Status constants
  Status: {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    REVOKED: 'revoked',
    REFUNDED: 'refunded'
  },

  // Access type constants
  Type: {
    STRIPE_PURCHASE: 'stripe_purchase',
    ADMIN_GRANT: 'admin_grant'
  },

  /**
   * Create a new content access record
   * Note: The database triggers will automatically update the user_scopes table
   * to materialize the access as scopes for the user.
   *
   * @param {Object} attrs - Access attributes
   * @param {String|Number} attrs.user_id - User receiving access
   * @param {String|Number} attrs.granted_by_group_id - Group granting the access (required)
   * @param {String|Number} [attrs.group_id] - Group the access is for (optional)
   * @param {String} attrs.access_type - Type: 'stripe_purchase' or 'admin_grant'
   * @param {String} [attrs.product_id] - Optional Stripe product ID
   * @param {String} [attrs.track_id] - Optional track ID
   * @param {String} [attrs.role_id] - Optional role ID
   * @param {Date} [attrs.expires_at] - Optional expiration date
   * @param {String} [attrs.stripe_session_id] - For Stripe purchases
   * @param {String} [attrs.stripe_subscription_id] - Stripe subscription ID (for recurring purchases)
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
   * @param {String|Number} params.grantedByGroupId - Group granting the access (required)
   * @param {String|Number} params.groupId - Group to grant access for (optional)
   * @param {String|Number} params.grantedById - Admin granting the access (optional)
   * @param {String|Number} [params.productId] - Optional product
   * @param {String|Number} [params.trackId] - Optional track
   * @param {String|Number} [params.groupRoleId] - Optional group role
   * @param {String|Number} [params.commonRoleId] - Optional common role
   * @param {Date} [params.expiresAt] - Optional expiration
   * @param {String} [params.reason] - Reason for granting access (stored in metadata)
   * @param {Object} options - Options including transacting
   * @returns {Promise<ContentAccess>}
   */
  grantAccess: async function ({
    userId,
    grantedByGroupId,
    groupId,
    grantedById,
    productId,
    trackId,
    groupRoleId,
    commonRoleId,
    expiresAt,
    reason
  }, { transacting } = {}) {
    const metadata = {}
    if (reason) metadata.reason = reason

    return this.create({
      user_id: userId,
      granted_by_group_id: grantedByGroupId,
      group_id: groupId,
      product_id: productId,
      track_id: trackId,
      group_role_id: groupRoleId,
      common_role_id: commonRoleId,
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
   * @param {String|Number} params.grantedByGroupId - Group making the purchase available (required)
   * @param {String|Number} params.groupId - Group the purchase is for (optional)
   * @param {String|Number} params.productId - Stripe product ID (from stripe_products table)
   * @param {String|Number} [params.trackId] - Optional track
   * @param {String|Number} [params.groupRoleId] - Optional group role
   * @param {String|Number} [params.commonRoleId] - Optional common role
   * @param {String} params.sessionId - Stripe checkout session ID
   * @param {String} [params.stripeSubscriptionId] - Stripe subscription ID (for recurring purchases)
   * @param {Date} [params.expiresAt] - When access expires
   * @param {Object} [params.metadata] - Additional metadata
   * @param {Object} options - Options including transacting
   * @returns {Promise<ContentAccess>}
   */
  recordPurchase: async function ({
    userId,
    grantedByGroupId,
    groupId,
    productId,
    trackId,
    groupRoleId,
    commonRoleId,
    sessionId,
    stripeSubscriptionId,
    expiresAt,
    metadata = {}
  }, { transacting } = {}) {
    return this.create({
      user_id: userId,
      granted_by_group_id: grantedByGroupId,
      group_id: groupId,
      product_id: productId,
      track_id: trackId,
      group_role_id: groupRoleId,
      common_role_id: commonRoleId,
      access_type: this.Type.STRIPE_PURCHASE,
      stripe_session_id: sessionId,
      stripe_subscription_id: stripeSubscriptionId,
      expires_at: expiresAt,
      metadata
    }, { transacting })
  },

  /**
   * Revoke access (changes status to revoked)
   * Also cancels any associated Stripe subscription.
   * Note: Database triggers will automatically remove the corresponding scopes
   * from the user_scopes table.
   *
   * @param {String|Number} accessId - The access record ID
   * @param {String|Number} revokedById - Admin who revoked the access
   * @param {String} [reason] - Reason for revocation
   * @param {Object} options - Options including transacting
   * @returns {Promise<ContentAccess>}
   */
  revoke: async function (accessId, revokedById, reason, { transacting } = {}) {
    const access = await this.where({ id: accessId }).fetch({
      transacting,
      withRelated: ['grantedByGroup']
    })
    if (!access) {
      throw new Error('Access record not found')
    }

    const subscriptionId = access.get('stripe_subscription_id')
    const grantedByGroup = access.related('grantedByGroup')

    // Cancel the Stripe subscription if one exists
    if (subscriptionId && grantedByGroup) {
      const stripeAccountId = grantedByGroup.get('stripe_account_id')
      if (stripeAccountId) {
        try {
          // Get the external Stripe account ID from StripeAccount model
          const stripeAccount = await StripeAccount.where({ id: stripeAccountId }).fetch()
          if (stripeAccount) {
            const externalAccountId = stripeAccount.get('stripe_account_external_id')
            await StripeService.cancelSubscription({
              accountId: externalAccountId,
              subscriptionId,
              immediately: true
            })
          }
        } catch (error) {
          // Log but don't fail the revocation if subscription cancellation fails
          console.error(`Failed to cancel subscription ${subscriptionId}:`, error.message)
        }
      }
    }

    const metadata = access.get('metadata') || {}
    metadata.revokedAt = new Date().toISOString()
    metadata.revokedBy = revokedById
    if (reason) metadata.revokeReason = reason
    if (subscriptionId) metadata.subscriptionCancelled = true

    return access.save({
      status: this.Status.REVOKED,
      metadata
    }, { transacting })
  },

  /**
   * Check if a user has active access to content
   * @param {Object} params
   * @param {String|Number} params.userId - User to check
   * @param {String|Number} params.grantedByGroupId - Group granting the access (required)
   * @param {String|Number} [params.groupId] - Specific group access is for (optional)
   * @param {String|Number} [params.productId] - Optional product
   * @param {String|Number} [params.trackId] - Optional track
   * @param {String|Number} [params.groupRoleId] - Optional group role
   * @param {String|Number} [params.commonRoleId] - Optional common role
   * @returns {Promise<ContentAccess|null>}
   */
  checkAccess: async function ({ userId, grantedByGroupId, groupId, productId, trackId, groupRoleId, commonRoleId }) {
    const query = this.where({
      user_id: userId,
      granted_by_group_id: grantedByGroupId,
      status: this.Status.ACTIVE
    })

    if (groupId) query.where({ group_id: groupId })
    if (productId) query.where({ product_id: productId })
    if (trackId) query.where({ track_id: trackId })
    if (groupRoleId) query.where({ group_role_id: groupRoleId })
    if (commonRoleId) query.where({ common_role_id: commonRoleId })

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
   * Get all active access records for a user granted by a specific group
   * @param {String|Number} userId
   * @param {String|Number} grantedByGroupId - Group granting the access
   * @returns {Promise<Collection<ContentAccess>>}
   */
  forUser: function (userId, grantedByGroupId) {
    return this.where({
      user_id: userId,
      granted_by_group_id: grantedByGroupId,
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
  },

  /**
   * Extend access expiration date (for subscription renewals)
   * @param {String|Number} accessId - ID of content_access record to extend
   * @param {Date} newExpiresAt - New expiration date
   * @param {Object} [extraMetadata] - Additional metadata to merge
   * @param {Object} options - Options including transacting
   * @returns {Promise<ContentAccess>}
   */
  extendAccess: async function (accessId, newExpiresAt, extraMetadata = {}, { transacting } = {}) {
    const access = await this.where({ id: accessId }).fetch({ transacting })
    if (!access) {
      throw new Error(`Content access record not found: ${accessId}`)
    }

    // Merge new metadata with existing
    const existingMetadata = access.get('metadata') || {}
    const updatedMetadata = {
      ...existingMetadata,
      ...extraMetadata,
      last_renewed_at: new Date().toISOString()
    }

    // Update expiration date and metadata
    // Note: The database trigger will handle updating user_scopes.expires_at
    return access.save({
      expires_at: newExpiresAt,
      status: this.Status.ACTIVE,
      metadata: updatedMetadata
    }, { transacting })
  },

  /**
   * Find content access records by Stripe subscription ID
   * Used for subscription renewals, cancellations, and refunds
   * @param {String} subscriptionId - Stripe subscription ID
   * @param {Object} options - Options including transacting
   * @returns {Promise<Collection<ContentAccess>>}
   */
  findBySubscriptionId: async function (subscriptionId, { transacting } = {}) {
    return this.where({ stripe_subscription_id: subscriptionId }).fetchAll({ transacting })
  },

  /**
   * Check if an access record is subscription-based
   * @param {ContentAccess} accessRecord - The access record to check
   * @returns {Boolean}
   */
  isSubscription: function (accessRecord) {
    return !!accessRecord.get('stripe_subscription_id')
  },

  /**
   * Get all active subscription-based access for a user
   * @param {String|Number} userId
   * @returns {Promise<Collection<ContentAccess>>}
   */
  getActiveSubscriptions: function (userId) {
    return this.query(qb => {
      qb.where({
        user_id: userId,
        status: this.Status.ACTIVE
      })
      qb.whereNotNull('stripe_subscription_id')
    }).fetchAll()
  },

  /**
   * Send renewal reminder emails for subscriptions renewing in 7 days
   * Called by daily cron job
   * @returns {Promise<Number>} Number of reminders sent
   */
  sendRenewalReminders: async function () {
    /* global User, Group, StripeProduct, Frontend */

    let remindersSent = 0
    const now = new Date()
    const sixDaysFromNow = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000)
    const eightDaysFromNow = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000)

    // Only query subscriptions where expires_at is in the 6-8 day window
    // We rely on expires_at from our database, no need to check Stripe
    const activeSubscriptions = await this.query(qb => {
      qb.where({
        status: this.Status.ACTIVE
      })
      qb.whereNotNull('stripe_subscription_id')
      qb.whereBetween('expires_at', [sixDaysFromNow.toISOString(), eightDaysFromNow.toISOString()])
    }).fetchAll({
      withRelated: ['user', 'product', 'group', 'grantedByGroup']
    })

    for (const access of activeSubscriptions.models) {
      try {
        const user = access.relations.user
        const product = access.relations.product
        const group = access.relations.grantedByGroup || access.relations.group

        if (!user || !product || !group) {
          continue
        }

        // Get expires_at from database (this is our renewal date)
        const expiresAt = access.get('expires_at')
        if (!expiresAt) {
          continue
        }

        const renewalDate = new Date(expiresAt)

        // Double-check it's within our window (should already be filtered by query, but safety check)
        if (renewalDate < sixDaysFromNow || renewalDate > eightDaysFromNow) {
          continue
        }

        // Check if reminder was already sent for this expiration date
        const metadata = access.get('metadata') || {}
        const lastReminderSentAt = metadata.renewal_reminder_sent_at
        const lastReminderExpiresAt = metadata.renewal_reminder_sent_for_expires_at

        // Skip if reminder already sent for this exact expiration date
        if (lastReminderExpiresAt === expiresAt) {
          continue
        }

        // Skip if reminder was sent in the last 8 days (avoid re-checking too soon)
        if (lastReminderSentAt) {
          const lastSentDate = new Date(lastReminderSentAt)
          const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
          if (lastSentDate > eightDaysAgo) {
            continue
          }
        }

        // Get subscription details for email from database
        const userLocale = user.getLocale()
        const renewalDateFormatted = renewalDate.toLocaleDateString(
          userLocale === 'es' ? 'es-ES' : 'en-US',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }
        )

        // Get renewal amount and period from product
        const priceInCents = product.get('price_in_cents') || 0
        const currency = product.get('currency') || 'usd'
        const renewalAmount = StripeService.formatPrice(priceInCents, currency)

        // Map duration to renewal period
        const duration = product.get('duration')
        let renewalPeriod = null
        if (duration === 'day') {
          renewalPeriod = 'daily'
        } else if (duration === 'month') {
          renewalPeriod = 'monthly'
        } else if (duration === 'season') {
          renewalPeriod = 'quarterly'
        } else if (duration === 'annual') {
          renewalPeriod = 'annual'
        } else if (duration) {
          renewalPeriod = duration
        }

        // Build email data
        const emailData = {
          user_name: user.get('name'),
          offering_name: product.get('name'),
          group_name: group.get('name'),
          group_url: Frontend.Route.group(group),
          renewal_date: renewalDateFormatted,
          renewal_amount: renewalAmount,
          renewal_period: renewalPeriod,
          manage_subscription_url: `${process.env.FRONTEND_URL || 'https://hylo.com'}/settings/subscriptions`,
          update_payment_url: `${process.env.FRONTEND_URL || 'https://hylo.com'}/settings/subscriptions`,
          group_avatar_url: group.get('avatar_url')
        }

        // Queue the email
        Queue.classMethod('Email', 'sendSubscriptionRenewalReminder', {
          email: user.get('email'),
          data: emailData,
          version: 'Redesign 2025',
          locale: userLocale
        })

        // Mark reminder as sent in metadata using expires_at
        const updatedMetadata = {
          ...metadata,
          renewal_reminder_sent_for_expires_at: expiresAt,
          renewal_reminder_sent_at: new Date().toISOString()
        }

        await access.save({ metadata: updatedMetadata })

        remindersSent++

        if (process.env.NODE_ENV === 'development') {
          console.log(`Queued renewal reminder email for user ${user.id}, expires at ${expiresAt}`)
        }
      } catch (error) {
        console.error(`Error sending renewal reminder for access ${access.id}:`, error)
        // Continue with next subscription
      }
    }

    return remindersSent
  },

  /**
   * Send expired access notification emails
   * Called by daily cron job
   * @returns {Promise<Number>} Number of notifications sent
   */
  sendExpiredAccessNotifications: async function () {
    /* global Track */

    let notificationsSent = 0
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    // Find access records that have expired recently (within the last week)
    // This avoids constantly checking old expired records
    // Query for records where expires_at is between one week ago and now
    // (regardless of status - webhooks may have already changed it)
    const expiredAccessRecords = await this.query(qb => {
      qb.where('expires_at', '<=', now.toISOString())
      qb.where('expires_at', '>=', threeDaysAgo.toISOString())
      qb.whereNotNull('expires_at')
    }).fetchAll({
      withRelated: ['user', 'product', 'group', 'grantedByGroup', 'track']
    })

    for (const access of expiredAccessRecords.models) {
      try {
        // Skip if status is revoked (don't send expiration email for revoked access)
        if (access.get('status') === this.Status.REVOKED) {
          continue
        }

        // If status is already expired, we still might need to send the email if we haven't sent it yet
        // If status is still active, we'll update it to expired

        const currentExpiresAt = access.get('expires_at')
        if (!currentExpiresAt) {
          continue
        }

        // Check if expiration email was already sent for this specific expiration date
        // This handles renewals: if expires_at changes, we'll send again for the new expiration
        const metadata = access.get('metadata') || {}
        const lastSentForExpiresAt = metadata.expiration_email_sent_for_expires_at

        // Skip if we already sent for this exact expiration date
        if (lastSentForExpiresAt === currentExpiresAt) {
          continue
        }

        // Double-check the access is actually expired (expires_at <= now)
        const expiresAtDate = new Date(currentExpiresAt)
        if (expiresAtDate > now) {
          continue
        }

        const user = access.relations.user
        const product = access.relations.product
        const group = access.relations.grantedByGroup || access.relations.group
        const track = access.relations.track

        if (!user || !group) {
          continue
        }

        // Update status to expired (if not already) and mark email as sent for this expiration date
        const updateData = {
          metadata: {
            ...metadata,
            expiration_email_sent_for_expires_at: currentExpiresAt,
            expiration_email_sent_at: new Date().toISOString()
          }
        }

        // Only update status if it's still active (webhooks may have already set it to expired)
        if (access.get('status') === this.Status.ACTIVE) {
          updateData.status = this.Status.EXPIRED
        }

        await access.save(updateData)

        const userLocale = user.getLocale()
        const expiresAt = new Date(access.get('expires_at'))
        const expiredAtFormatted = expiresAt.toLocaleDateString(
          userLocale === 'es' ? 'es-ES' : 'en-US',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }
        )

        // Determine access type
        const accessType = track ? 'track' : 'group'

        // Get available offerings for the group
        const availableOfferings = []
        if (product) {
          // Get all published offerings for this group
          const offerings = await StripeProduct.where({
            group_id: group.id,
            publish_status: 'published'
          }).fetchAll()

          for (const offering of offerings.models) {
            const priceInCents = offering.get('price_in_cents') || 0
            const currency = offering.get('currency') || 'usd'
            const priceFormatted = StripeService.formatPrice(priceInCents, currency)

            availableOfferings.push({
              name: offering.get('name'),
              price: priceFormatted
            })
          }
        }

        const emailData = {
          user_name: user.get('name'),
          access_type: accessType,
          group_name: group.get('name'),
          group_url: Frontend.Route.group(group),
          expired_at: expiredAtFormatted,
          renew_url: Frontend.Route.group(group),
          available_offerings: availableOfferings,
          group_avatar_url: group.get('avatar_url')
        }

        // Add track info if applicable
        if (track) {
          emailData.track_name = track.get('name')
        }

        Queue.classMethod('Email', 'sendAccessExpired', {
          email: user.get('email'),
          data: emailData,
          version: 'Redesign 2025',
          locale: userLocale
        })

        notificationsSent++

        if (process.env.NODE_ENV === 'development') {
          console.log(`Queued Access Expired email to user ${user.id} for access ${access.id}`)
        }
      } catch (error) {
        console.error(`Error sending expired access notification for access ${access.id}:`, error)
        // Continue with next access record
      }
    }

    return notificationsSent
  }
})
