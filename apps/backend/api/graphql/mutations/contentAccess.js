/**
 * Content Access GraphQL Mutations
 *
 * Provides GraphQL API for managing content access grants:
 * - Admin-granted free access to content
 * - Recording Stripe purchases
 * - Revoking access
 */

import { GraphQLError } from 'graphql'

/* global ContentAccess, GroupMembership, User, Group, Responsibility, Track */

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
   *       grantedByGroupId: "123"
   *       groupId: "789"  // optional - for access to a group
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
    grantedByGroupId,
    groupId,
    productId,
    trackId,
    roleId,
    expiresAt,
    reason
  }) => {
    try {
      // Check if user is authenticated
      if (!sessionUserId) {
        throw new GraphQLError('You must be logged in to grant content access')
      }

      // Verify the granting group exists first
      const grantingGroup = await Group.where({ id: grantedByGroupId }).fetch()
      if (!grantingGroup) {
        throw new GraphQLError('Granting group not found')
      }

      // Verify user has admin permission for the granting group
      const hasAdmin = await GroupMembership.hasResponsibility(sessionUserId, grantedByGroupId, Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be an administrator of the granting group to grant content access')
      }

      // Verify the target user exists
      const targetUser = await User.where({ id: userId }).fetch()
      if (!targetUser) {
        throw new GraphQLError('User not found')
      }

      // If groupId is provided, verify it exists
      if (groupId) {
        const targetGroup = await Group.where({ id: groupId }).fetch()
        if (!targetGroup) {
          throw new GraphQLError('Target group not found')
        }
      }

      // Must provide either productId, trackId, or roleId
      if (!productId && !trackId && !roleId) {
        throw new GraphQLError('Must specify either productId, trackId, or roleId')
      }

      // Grant access using the ContentAccess model
      const access = await ContentAccess.grantAccess({
        userId,
        grantedByGroupId,
        groupId,
        grantedById: sessionUserId,
        productId,
        trackId,
        roleId,
        expiresAt,
        reason
      })

      // Auto-enroll user in track when access is granted
      if (trackId) {
        try {
          await Track.enroll(trackId, userId)
        } catch (enrollError) {
          // Log but don't fail the access grant if enrollment fails
          console.warn(`Auto-enrollment in track ${trackId} failed for user ${userId}:`, enrollError.message)
        }
      }

      return {
        id: access.id,
        userId,
        grantedByGroupId,
        groupId,
        productId,
        trackId,
        roleId,
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

      // Check permissions against the granting group
      const hasAdmin = await GroupMembership.hasResponsibility(sessionUserId, access.get('granted_by_group_id'), Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be an administrator of the granting group to revoke access')
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
   *       grantedByGroupId: "123"
   *       groupId: "789"  // optional
   *       productId: "789"
   *       trackId: "101"  // optional
   *       roleId: "202"   // optional
   *       sessionId: "cs_xxx"
   *       stripeSubscriptionId: "sub_xxx"  // optional, for recurring
   *     ) {
   *       id
   *       success
   *     }
   *   }
   */
  recordStripePurchase: async (sessionUserId, {
    userId,
    grantedByGroupId,
    groupId,
    productId,
    trackId,
    roleId,
    sessionId,
    stripeSubscriptionId,
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
        grantedByGroupId,
        groupId,
        productId,
        trackId,
        roleId,
        sessionId,
        stripeSubscriptionId,
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
