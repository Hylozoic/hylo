/**
 * Content Access GraphQL Mutations
 *
 * Provides GraphQL API for managing content access grants:
 * - Admin-granted free access to content
 * - Recording Stripe purchases
 * - Checking and revoking access
 */

import { GraphQLError } from 'graphql'

/* global ContentAccess */

module.exports = {

  /**
   * Grant free access to content (admin only)
   *
   * Allows group administrators to grant users free access to paid content
   * without requiring a Stripe purchase. Useful for comps, staff access,
   * promotional access, etc.
   *
   * Usage:
   *   mutation {
   *     grantContentAccess(
   *       userId: "456"
   *       groupId: "123"
   *       productId: "789"  // optional - for product-based access
   *       trackId: "101"    // optional - for track-based access
   *       expiresAt: "2025-12-31T23:59:59Z"  // optional
   *       reason: "Staff member"
   *     ) {
   *       id
   *       success
   *       message
   *     }
   *   }
   */
  grantContentAccess: async (root, {
    userId,
    groupId,
    productId,
    trackId,
    expiresAt,
    reason
  }, { session }) => {
    try {
      // Check if user is authenticated
      if (!session || !session.userId) {
        throw new GraphQLError('You must be logged in to grant content access')
      }

      // Verify user has admin permission for this group
      const membership = await GroupMembership.forPair(session.userId, groupId).fetch()
      if (!membership || !membership.hasResponsibility(GroupMembership.RESP_ADMINISTRATION)) {
        throw new GraphQLError('You must be a group administrator to grant content access')
      }

      // Verify the target user exists
      const targetUser = await User.find(userId)
      if (!targetUser) {
        throw new GraphQLError('User not found')
      }

      // Verify the group exists
      const group = await Group.find(groupId)
      if (!group) {
        throw new GraphQLError('Group not found')
      }

      // Must provide either productId or trackId
      if (!productId && !trackId) {
        throw new GraphQLError('Must specify either productId or trackId')
      }

      // Grant access using the ContentAccess model
      const access = await ContentAccess.grantAccess({
        userId,
        groupId,
        grantedById: session.userId,
        productId,
        trackId,
        expiresAt,
        reason
      })

      return {
        id: access.id,
        userId,
        groupId,
        productId,
        trackId,
        accessType: access.get('access_type'),
        status: access.get('status'),
        success: true,
        message: 'Access granted successfully'
      }
    } catch (error) {
      console.error('Error in grantContentAccess:', error)
      throw new GraphQLError(`Failed to grant access: ${error.message}`)
    }
  },

  /**
   * Revoke content access (admin only)
   *
   * Allows group administrators to revoke previously granted access.
   * Can be used for both purchased and admin-granted access.
   *
   * Usage:
   *   mutation {
   *     revokeContentAccess(
   *       accessId: "123"
   *       reason: "User violated terms"
   *     ) {
   *       success
   *       message
   *     }
   *   }
   */
  revokeContentAccess: async (root, { accessId, reason }, { session }) => {
    try {
      // Check if user is authenticated
      if (!session || !session.userId) {
        throw new GraphQLError('You must be logged in to revoke content access')
      }

      // Load the access record and verify permissions
      const access = await ContentAccess.where({ id: accessId }).fetch()
      if (!access) {
        throw new GraphQLError('Access record not found')
      }

      const membership = await GroupMembership.forPair(session.userId, access.get('group_id')).fetch()
      if (!membership || !membership.hasResponsibility(GroupMembership.RESP_ADMINISTRATION)) {
        throw new GraphQLError('You must be a group administrator to revoke access')
      }

      // Revoke the access using the model method
      await ContentAccess.revoke(accessId, session.userId, reason)

      return {
        success: true,
        message: 'Access revoked successfully'
      }
    } catch (error) {
      console.error('Error in revokeContentAccess:', error)
      throw new GraphQLError(`Failed to revoke access: ${error.message}`)
    }
  },

  /**
   * Check if user has access to content
   *
   * Query to check if a user has active access to specific content.
   * Can be used by the frontend to gate content display.
   *
   * Usage:
   *   query {
   *     checkContentAccess(
   *       userId: "456"
   *       groupId: "123"
   *       productId: "789"  // or trackId: "101"
   *     ) {
   *       hasAccess
   *       accessType
   *       expiresAt
   *     }
   *   }
   */
  checkContentAccess: async (root, { userId, groupId, productId, trackId }, { session }) => {
    try {
      // Check access using the model method
      const access = await ContentAccess.checkAccess({
        userId,
        groupId,
        productId,
        trackId
      })

      if (!access) {
        return {
          hasAccess: false,
          accessType: null,
          expiresAt: null,
          grantedAt: null
        }
      }

      return {
        hasAccess: true,
        accessType: access.get('access_type'),
        expiresAt: access.get('expires_at'),
        grantedAt: access.get('created_at')
      }
    } catch (error) {
      console.error('Error in checkContentAccess:', error)
      throw new GraphQLError(`Failed to check access: ${error.message}`)
    }
  },

  /**
   * Record a Stripe purchase
   *
   * Internal mutation to record successful Stripe purchases.
   * This should be called from the Stripe webhook handler after
   * a successful checkout.session.completed event.
   *
   * Usage (internal):
   *   mutation {
   *     recordStripePurchase(
   *       userId: "456"
   *       groupId: "123"
   *       productId: "789"
   *       sessionId: "cs_xxx"
   *       paymentIntentId: "pi_xxx"
   *       amountPaid: 2000
   *       currency: "usd"
   *     ) {
   *       id
   *       success
   *     }
   *   }
   */
  recordStripePurchase: async (root, {
    userId,
    groupId,
    productId,
    trackId,
    roleId,
    sessionId,
    paymentIntentId,
    amountPaid,
    currency,
    expiresAt,
    metadata
  }, { session }) => {
    try {
      // This mutation should ideally only be called internally from webhook handler
      // For security, you might want to add special authentication for this

      // Record the purchase using the model method
      const access = await ContentAccess.recordPurchase({
        userId,
        groupId,
        productId,
        trackId,
        roleId,
        sessionId,
        paymentIntentId,
        amountPaid,
        currency,
        expiresAt,
        metadata: metadata || {}
      })

      return {
        id: access.id,
        success: true,
        message: 'Purchase recorded successfully'
      }
    } catch (error) {
      console.error('Error in recordStripePurchase:', error)
      throw new GraphQLError(`Failed to record purchase: ${error.message}`)
    }
  }
}
