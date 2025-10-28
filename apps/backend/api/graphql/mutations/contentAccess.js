/**
 * Content Access GraphQL Mutations
 *
 * Provides GraphQL API for managing content access grants:
 * - Admin-granted free access to content
 * - Recording Stripe purchases
 * - Checking and revoking access
 */

import { GraphQLError } from 'graphql'

/* global ContentAccess, GroupMembership, User, Group, Responsibility */

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
  grantContentAccess: async (sessionUserId, {
    userId,
    groupId,
    productId,
    trackId,
    expiresAt,
    reason
  }) => {
    try {
      // Check if user is authenticated
      if (!sessionUserId) {
        throw new GraphQLError('You must be logged in to grant content access')
      }

      // Verify the group exists first
      const group = await Group.where({ id: groupId }).fetch()
      if (!group) {
        throw new GraphQLError('Group not found')
      }

      // Verify user has admin permission for this group
      const hasAdmin = await GroupMembership.hasResponsibility(sessionUserId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to grant content access')
      }

      // Verify the target user exists
      const targetUser = await User.where({ id: userId }).fetch()
      if (!targetUser) {
        throw new GraphQLError('User not found')
      }

      // Must provide either productId or trackId
      if (!productId && !trackId) {
        throw new GraphQLError('Must specify either productId or trackId')
      }

      // Grant access using the ContentAccess model
      const access = await ContentAccess.grantAccess({
        userId,
        groupId,
        grantedById: sessionUserId,
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
      if (error instanceof GraphQLError) {
        throw error
      }
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
  revokeContentAccess: async (sessionUserId, { accessId, reason }) => {
    try {
      // Check if user is authenticated
      if (!sessionUserId) {
        throw new GraphQLError('You must be logged in to revoke content access')
      }

      // Load the access record and verify permissions
      const access = await ContentAccess.where({ id: accessId }).fetch()
      if (!access) {
        throw new GraphQLError('Access record not found')
      }

      const hasAdmin = await GroupMembership.hasResponsibility(sessionUserId, access.get('group_id'), Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to revoke access')
      }

      // Revoke the access using the model method
      await ContentAccess.revoke(accessId, sessionUserId, reason)

      return {
        success: true,
        message: 'Access revoked successfully'
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
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
  checkContentAccess: async (sessionUserId, { userId, groupId, productId, trackId }) => {
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
      if (error instanceof GraphQLError) {
        throw error
      }
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
  recordStripePurchase: async (sessionUserId, {
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
  }) => {
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
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in recordStripePurchase:', error)
      throw new GraphQLError(`Failed to record purchase: ${error.message}`)
    }
  }
}
