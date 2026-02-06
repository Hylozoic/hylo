/**
 * Content Access GraphQL Mutations
 *
 * Provides GraphQL API for managing content access grants:
 * - Admin-granted free access to content
 * - Recording Stripe purchases
 * - Revoking access
 * - Refunding purchases
 */

import { GraphQLError } from 'graphql'
const StripeService = require('../../services/StripeService')

/* global ContentAccess, GroupMembership, User, Group, Responsibility, Track, StripeProduct, GroupRole, Frontend, StripeAccount */

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
    groupRoleId,
    commonRoleId,
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

      // Must provide either groupId, productId, trackId, groupRoleId, or commonRoleId
      if (!groupId && !productId && !trackId && !groupRoleId && !commonRoleId) {
        throw new GraphQLError('Must specify either groupId, productId, trackId, groupRoleId, or commonRoleId')
      }

      // Grant access using the ContentAccess model
      const access = await ContentAccess.grantAccess({
        userId,
        grantedByGroupId,
        groupId,
        grantedById: sessionUserId,
        productId,
        trackId,
        groupRoleId,
        commonRoleId,
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
        } else if (groupRoleId) {
          accessType = 'group_role'
          const roleIdToUse = groupRoleId
          const role = await GroupRole.where({ id: roleIdToUse }).fetch()
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
        } else if (commonRoleId) {
          accessType = 'common_role'
          /* global CommonRole */
          const role = await CommonRole.where({ id: commonRoleId }).fetch()
          if (role) {
            accessName = role.get('name')
            // Common role access is within a group context
            contextGroup = await Group.find(grantedByGroupId)
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
        groupRoleId: access.get('group_role_id'),
        commonRoleId: access.get('common_role_id'),
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
   *       id
   *       status
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

      // Revoke the access using the model method - returns the updated record
      const revokedAccess = await ContentAccess.revoke(accessId, sessionUserId, reason)

      return revokedAccess
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
   *       groupRoleId: "202"   // optional
   *       commonRoleId: "203"   // optional
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
    groupRoleId,
    commonRoleId,
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
        groupRoleId,
        commonRoleId,
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
  },

  /**
   * Refund content access (admin only)
   *
   * Revokes access, cancels any associated subscription, and issues a Stripe refund
   * for the most recent payment. This is a destructive action that cannot be undone.
   *
   * Usage:
   *   mutation {
   *     refundContentAccess(
   *       accessId: "123"
   *       reason: "Customer requested refund"
   *     ) {
   *       id
   *       status
   *       metadata
   *     }
   *   }
   */
  refundContentAccess: async (sessionUserId, { accessId, reason }) => {
    try {
      // Check if user is authenticated
      if (!sessionUserId) {
        throw new GraphQLError('You must be logged in to refund content access')
      }

      // Load the access record with related data
      const access = await ContentAccess.where({ id: accessId }).fetch({
        withRelated: ['grantedByGroup']
      })
      if (!access) {
        throw new GraphQLError('Access record not found')
      }

      // Check permissions against the granting group
      const hasAdmin = await GroupMembership.hasResponsibility(
        sessionUserId,
        access.get('granted_by_group_id'),
        Responsibility.constants.RESP_ADMINISTRATION
      )
      if (!hasAdmin) {
        throw new GraphQLError('You must be an administrator of the granting group to refund access')
      }

      // Verify this is a Stripe purchase (not an admin grant)
      if (access.get('access_type') !== ContentAccess.Type.STRIPE_PURCHASE) {
        throw new GraphQLError('Only Stripe purchases can be refunded. Admin grants should be revoked instead.')
      }

      // Get the Stripe account info
      const grantedByGroup = access.related('grantedByGroup')
      const stripeAccountId = grantedByGroup.get('stripe_account_id')
      if (!stripeAccountId) {
        throw new GraphQLError('No Stripe account found for the granting group')
      }

      const stripeAccount = await StripeAccount.where({ id: stripeAccountId }).fetch()
      if (!stripeAccount) {
        throw new GraphQLError('Stripe account record not found')
      }
      const externalAccountId = stripeAccount.get('stripe_account_external_id')

      // Issue the refund
      const subscriptionId = access.get('stripe_subscription_id')
      const sessionId = access.get('stripe_session_id')
      let refund = null

      if (process.env.NODE_ENV === 'development') {
        console.log(`[RefundContentAccess] subscriptionId: ${subscriptionId}, sessionId: ${sessionId}, accountId: ${externalAccountId}`)
      }

      if (subscriptionId) {
        // For subscriptions, StripeService.refund handles finding the payment:
        // 1. First tries listing paid invoices
        // 2. Falls back to subscription.latest_invoice.payment_intent
        // 3. Falls back to listing all invoices
        try {
          refund = await StripeService.refund({
            accountId: externalAccountId,
            subscriptionId,
            reason: 'requested_by_customer'
          })
        } catch (subscriptionRefundError) {
          // If subscription-based refund fails but we have a session ID, try that
          if (process.env.NODE_ENV === 'development') {
            console.log(`[RefundContentAccess] Subscription refund failed: ${subscriptionRefundError.message}`)
          }
          if (sessionId) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[RefundContentAccess] Trying checkout session as fallback...')
            }
            const session = await StripeService.getCheckoutSession(externalAccountId, sessionId)
            if (process.env.NODE_ENV === 'development') {
              console.log(`[RefundContentAccess] Session mode: ${session.mode}, payment_intent: ${session.payment_intent}, invoice: ${session.invoice}`)
            }

            // For subscription sessions, try the invoice first
            if (session.invoice) {
              const invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice.id
              if (process.env.NODE_ENV === 'development') {
                console.log(`[RefundContentAccess] Fetching invoice: ${invoiceId}`)
              }
              const invoice = await StripeService.getInvoice(externalAccountId, invoiceId)
              if (process.env.NODE_ENV === 'development') {
                console.log(`[RefundContentAccess] Invoice: amount_due=${invoice.amount_due}, amount_paid=${invoice.amount_paid}, total=${invoice.total}, status=${invoice.status}`)
                console.log(`[RefundContentAccess] Invoice payment_intent: ${invoice.payment_intent?.id || invoice.payment_intent}, charge: ${invoice.charge?.id || invoice.charge}`)
              }

              // If it's a $0 invoice, we can't refund
              if (invoice.amount_due === 0 || invoice.total === 0) {
                throw new Error('This subscription had a $0 invoice - no payment was made, so there is nothing to refund.')
              }

              if (invoice.payment_intent) {
                const paymentIntentId = typeof invoice.payment_intent === 'string'
                  ? invoice.payment_intent
                  : invoice.payment_intent.id
                refund = await StripeService.refund({
                  accountId: externalAccountId,
                  paymentIntentId,
                  reason: 'requested_by_customer'
                })
              } else if (invoice.charge) {
                const chargeId = typeof invoice.charge === 'string'
                  ? invoice.charge
                  : invoice.charge.id
                refund = await StripeService.refund({
                  accountId: externalAccountId,
                  chargeId,
                  reason: 'requested_by_customer'
                })
              }
            }

            // If still no refund, try payment_intent (though this is usually null for subscriptions)
            if (!refund && session.payment_intent) {
              const paymentIntentId = typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent.id
              refund = await StripeService.refund({
                accountId: externalAccountId,
                paymentIntentId,
                reason: 'requested_by_customer'
              })
            }

            if (!refund) {
              throw subscriptionRefundError
            }
          } else {
            throw subscriptionRefundError
          }
        }
      } else if (sessionId) {
        // For one-time payments, get the payment intent from the session
        const session = await StripeService.getCheckoutSession(externalAccountId, sessionId)
        if (session.payment_intent) {
          const paymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent.id
          refund = await StripeService.refund({
            accountId: externalAccountId,
            paymentIntentId,
            reason: 'requested_by_customer'
          })
        }
      }

      if (!refund) {
        throw new GraphQLError('Unable to issue refund: no payment found for this access record')
      }

      // IMPORTANT: Set status to REFUNDED *before* cancelling subscription
      // This prevents the subscription.deleted webhook from overwriting to 'expired'
      const metadata = access.get('metadata') || {}
      metadata.refundId = refund.id
      metadata.refundAmount = refund.amount
      metadata.refundedAt = new Date().toISOString()
      metadata.refundedBy = sessionUserId
      metadata.revokedAt = new Date().toISOString()
      metadata.revokedBy = sessionUserId
      if (reason) metadata.refundReason = reason

      // Save REFUNDED status first
      await access.save({
        status: ContentAccess.Status.REFUNDED,
        metadata
      }, { patch: true })

      // Now cancel the subscription (if any) - webhook will see REFUNDED status and skip
      if (subscriptionId) {
        try {
          await StripeService.cancelSubscription({
            accountId: externalAccountId,
            subscriptionId,
            immediately: true
          })
          // Update metadata to note subscription was cancelled
          metadata.subscriptionCancelled = true
          await access.save({ metadata }, { patch: true })
        } catch (cancelError) {
          console.error(`Failed to cancel subscription ${subscriptionId}:`, cancelError.message)
          // Don't fail the refund if subscription cancellation fails
        }
      }

      // Refresh the access record to return current state
      await access.refresh()
      return access
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in refundContentAccess:', error)
      throw new GraphQLError(`Failed to refund access: ${error.message}`)
    }
  }
}
