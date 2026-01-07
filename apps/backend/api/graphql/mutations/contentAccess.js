/**
 * Content Access GraphQL Mutations
 *
 * Provides GraphQL API for managing content access grants:
 * - Admin-granted free access to content
 * - Recording Stripe purchases
 * - Revoking access
 */

import { GraphQLError } from 'graphql'
const Queue = require('../../services/Queue')

/* global ContentAccess, GroupMembership, User, Group, Responsibility, Track, StripeProduct, GroupRole, Frontend */

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

      // Must provide either groupId, productId, trackId, or roleId
      if (!groupId && !productId && !trackId && !roleId) {
        throw new GraphQLError('Must specify either groupId, productId, trackId, or roleId')
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

      if (groupId) {
        try {
          await GroupMembership.ensureMembership(userId, groupId, {
            role: GroupMembership.Role.DEFAULT
          })

          if (process.env.NODE_ENV === 'development') {
            console.log(`Created group membership for user ${userId} in group ${groupId} via admin grant`)
          }
        } catch (membershipError) {
          // Log but don't fail the access grant if membership creation fails
          console.warn(`Group membership creation failed for user ${userId} in group ${groupId}:`, membershipError.message)
        }
      }

      // Send Admin-Granted Access email
      try {
        const userLocale = targetUser.getLocale()
        const grantedByUser = await User.find(sessionUserId)

        // Determine access type and gather data
        let accessType = null
        let accessName = null
        let accessUrl = null
        let contextGroup = null
        let contextGroupName = null
        let contextGroupUrl = null

        if (trackId) {
          accessType = 'track'
          const track = await Track.find(trackId)
          if (track) {
            accessName = track.get('name')
            // Track access is always within a group context
            const trackGroupId = track.get('group_id')
            contextGroup = await Group.find(trackGroupId)
            if (contextGroup) {
              contextGroupName = contextGroup.get('name')
              contextGroupUrl = Frontend.Route.group(contextGroup)
              accessUrl = Frontend.Route.track(track, contextGroup)
            }
          }
        } else if (roleId) {
          accessType = 'role'
          const role = await GroupRole.where({ id: roleId }).fetch()
          if (role) {
            accessName = role.get('name')
            // Role access is within a group context
            const roleGroupId = role.get('group_id')
            contextGroup = await Group.find(roleGroupId)
            if (contextGroup) {
              contextGroupName = contextGroup.get('name')
              contextGroupUrl = Frontend.Route.group(contextGroup)
              accessUrl = contextGroupUrl
            }
          }
        } else if (productId) {
          accessType = 'offering'
          const product = await StripeProduct.where({ id: productId }).fetch()
          if (product) {
            accessName = product.get('name')
            // Product access is within a group context
            const productGroupId = product.get('group_id')
            contextGroup = await Group.find(productGroupId)
            if (contextGroup) {
              contextGroupName = contextGroup.get('name')
              contextGroupUrl = Frontend.Route.group(contextGroup)
              accessUrl = contextGroupUrl
            }
          }
        } else if (groupId) {
          accessType = 'group'
          contextGroup = await Group.find(groupId)
          if (contextGroup) {
            accessName = contextGroup.get('name')
            accessUrl = Frontend.Route.group(contextGroup)
            contextGroupName = accessName
            contextGroupUrl = accessUrl
          }
        }

        // Build email data
        const emailData = {
          user_name: targetUser.get('name'),
          access_type: accessType,
          access_name: accessName,
          access_url: accessUrl,
          granted_by_name: grantedByUser ? grantedByUser.get('name') : 'Administrator'
        }

        // Add context group info if available
        if (contextGroupName) {
          emailData.group_name = contextGroupName
        }
        if (contextGroupUrl) {
          emailData.group_url = contextGroupUrl
        }
        if (contextGroup) {
          emailData.group_avatar_url = contextGroup.get('avatar_url')
        }

        // Add expiration date if provided
        if (expiresAt) {
          const expiresAtDate = new Date(expiresAt)
          emailData.expires_at = expiresAtDate.toLocaleDateString(userLocale === 'es' ? 'es-ES' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        }

        // Queue the email
        Queue.classMethod('Email', 'sendAccessGranted', {
          email: targetUser.get('email'),
          data: emailData,
          version: 'Redesign 2025',
          locale: userLocale
        })

        if (process.env.NODE_ENV === 'development') {
          console.log(`Queued Admin-Granted Access email to user ${userId}`)
        }
      } catch (emailError) {
        // Log error but don't fail the access grant if email fails
        console.error('Error queueing admin-granted access email:', emailError)
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
