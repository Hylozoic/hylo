/**
 * StripeController
 *
 * Controller for handling Stripe Connect REST endpoints.
 * Provides endpoints for:
 * - Handling OAuth redirects
 * - Processing webhooks
 * - Handling checkout success/cancel pages
 */

const StripeService = require('../services/StripeService')
const Stripe = require('stripe')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover'
})

/* global StripeAccount, StripeProduct, ContentAccess, GroupMembership */

module.exports = {

  /**
   * Handles successful checkout and displays confirmation
   *
   * Called when a customer completes a purchase and is redirected
   * from Stripe Checkout. Retrieves the session to verify payment.
   *
   * GET /noo/stripe/checkout/success?session_id=xxx&account_id=xxx
   */
  checkoutSuccess: async function (req, res) {
    try {
      const sessionId = req.query.session_id
      const accountId = req.query.account_id

      if (!sessionId || !accountId) {
        return res.status(400).json({
          error: 'Missing session_id or account_id parameter'
        })
      }

      // Retrieve the checkout session to verify payment
      const session = await StripeService.getCheckoutSession(accountId, sessionId)

      // TODO STRIPE:
      // In a real application, you would:
      // 1. Grant access to the purchased content
      // 2. Send confirmation email
      // 3. Update your database
      // 4. Redirect to appropriate page

      return res.json({
        success: true,
        message: 'Payment successful!',
        session: {
          id: session.id,
          payment_status: session.payment_status,
          amount_total: session.amount_total,
          currency: session.currency
        }
      })
    } catch (error) {
      console.error('Error in checkoutSuccess:', error)
      return res.status(500).json({
        error: 'Failed to process successful checkout',
        message: error.message
      })
    }
  },

  /**
   * Handles checkout cancellation
   *
   * Called when a customer cancels the checkout process
   *
   * GET /noo/stripe/checkout/cancel
   */
  checkoutCancel: function (req, res) {
    // In a real application, you might want to:
    // 1. Log the cancellation
    // 2. Show a message to the user
    // 3. Redirect back to the product page

    return res.json({
      success: false,
      message: 'Checkout was cancelled'
    })
  },

  /**
   * Webhook endpoint for Stripe events
   *
   * Stripe sends webhook events for important account and payment updates.
   * This endpoint verifies the webhook signature and processes events.
   *
   * POST /noo/stripe/webhook
   */
  webhook: async function (req, res) {
    try {
      // Get the webhook signature from headers
      const signature = req.headers['stripe-signature']

      if (!signature) {
        console.error('Missing Stripe signature header')
        return res.status(400).json({ error: 'Missing signature' })
      }

      // Verify webhook signature
      let event
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        )
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message)
        return res.status(400).json({ error: 'Invalid signature' })
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`Processing webhook event: ${event.type}`)
      }

      // Handle different event types
      switch (event.type) {
        case 'account.updated':
          await this.handleAccountUpdated(event)
          break

        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event)
          break

        case 'product.updated':
          await this.handleProductUpdated(event)
          break

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event)
          break

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event)
          break

        case 'invoice.paid':
          await this.handleInvoicePaid(event)
          break

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event)
          break

        case 'charge.refunded':
          await this.handleChargeRefunded(event)
          break

        default:
          if (process.env.NODE_ENV === 'development') {
            console.log(`Unhandled event type: ${event.type}`)
          }
      }

      // Return a 200 response to acknowledge receipt of the event
      return res.json({ received: true })
    } catch (error) {
      console.error('Webhook error:', error)
      return res.status(400).json({
        error: 'Webhook processing failed',
        message: error.message
      })
    }
  },

  /**
   * Handle account.updated webhook events
   * Updates group's Stripe account status when onboarding changes
   */
  handleAccountUpdated: async function (event) {
    try {
      const account = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Account updated: ${account.id}`)
      }

      // Extract group ID from account metadata
      const groupId = account.metadata?.group_id
      if (!groupId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No group_id metadata found for Stripe account: ${account.id}`)
        }
        return
      }

      const group = await Group.find(groupId)
      if (!group) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No group found with ID: ${groupId}`)
        }
        return
      }

      // Find or create the StripeAccount record for this external account ID
      let stripeAccountRecord = await StripeAccount.where({
        stripe_account_external_id: account.id
      }).fetch()

      if (!stripeAccountRecord) {
        stripeAccountRecord = await StripeAccount.forge({
          stripe_account_external_id: account.id
        }).save()
      }

      // Update group's Stripe status
      // Note: stripe_account_id should be the database ID, not the external account ID
      await group.save({
        stripe_account_id: stripeAccountRecord.id, // Store database ID, not external account ID
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
        stripe_details_submitted: account.details_submitted
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(`Updated Stripe status for group ${group.get('id')}`)
      }
    } catch (error) {
      console.error('Error handling account.updated:', error)
      throw error
    }
  },

  /**
   * Handle checkout.session.completed webhook events
   * Grants access to content when checkout completes successfully
   */
  handleCheckoutSessionCompleted: async function (event) {
    try {
      const session = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Checkout session completed: ${session.id}`)
      }

      // Verify payment was successful
      if (session.payment_status !== 'paid') {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Checkout session ${session.id} completed but payment status is ${session.payment_status}`)
        }
        return
      }

      // Extract user and product info from session metadata
      const userId = session.metadata?.userId
      const groupId = session.metadata?.groupId
      const offeringId = session.metadata?.offeringId

      if (!userId || !groupId || !offeringId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Missing required metadata in session ${session.id}:`, {
            userId: !!userId,
            groupId: !!groupId,
            offeringId: !!offeringId
          })
        }
        return
      }

      // Find the offering (StripeProduct) by database ID
      const offering = await StripeProduct.where({ id: offeringId }).fetch()
      if (!offering) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No offering found for ID: ${offeringId}`)
        }
        return
      }

      // Verify the offering belongs to the specified group
      const offeringGroupId = offering.get('group_id')
      if (parseInt(offeringGroupId) !== parseInt(groupId)) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Offering ${offeringId} does not belong to group ${groupId}`)
        }
        return
      }

      // Determine if this is a subscription based on session mode
      const stripeSubscriptionId = session.subscription || null

      // Generate content access records
      const accessRecords = await offering.generateContentAccessRecords({
        userId: parseInt(userId, 10),
        sessionId: session.id,
        stripeSubscriptionId,
        metadata: {
          paymentAmount: session.amount_total,
          currency: session.currency,
          purchasedAt: new Date().toISOString()
        }
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(`Created ${accessRecords.length} content access records for user ${userId}`)
      }

      // Grant group membership for any groups that received access
      const userIdNum = parseInt(userId, 10)

      // Collect unique group IDs that received access
      const groupsToJoin = new Set()
      for (const accessRecord of accessRecords) {
        const accessGroupId = accessRecord.get('group_id')
        if (accessGroupId) {
          groupsToJoin.add(parseInt(accessGroupId, 10))
        }
      }

      // Ensure user is a member of all groups that received access
      for (const accessGroupId of groupsToJoin) {
        try {
          await GroupMembership.ensureMembership(userIdNum, accessGroupId, {
            role: GroupMembership.Role.DEFAULT
          })
          if (process.env.NODE_ENV === 'development') {
            console.log(`Ensured group membership for user ${userIdNum} in group ${accessGroupId}`)
          }
        } catch (error) {
          console.error(`Error ensuring membership for user ${userIdNum} in group ${accessGroupId}:`, error)
          // Continue processing other groups even if one fails
        }
      }

      // TODO STRIPE: Send confirmation email to user
      // TODO STRIPE: Send notification to group admins
    } catch (error) {
      console.error('Error handling checkout.session.completed:', error)
      throw error
    }
  },

  /**
   * Handle product.updated webhook events
   * Syncs product changes from Stripe back to our database
   */
  handleProductUpdated: async function (event) {
    try {
      const product = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Product updated in Stripe: ${product.id}`)
      }

      // Find our database record for this product
      const dbProduct = await StripeProduct.findByStripeId(product.id)
      if (!dbProduct) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No database record found for Stripe product: ${product.id}`)
        }
        return
      }

      // Get the current price information
      const expandedProduct = await stripe.products.retrieve(product.id, {
        expand: ['default_price']
      })

      // Check if our database record needs updating
      const needsUpdate = {}

      if (dbProduct.get('name') !== expandedProduct.name) {
        needsUpdate.name = expandedProduct.name
      }

      if (dbProduct.get('description') !== expandedProduct.description) {
        needsUpdate.description = expandedProduct.description
      }

      if (dbProduct.get('price_in_cents') !== expandedProduct.default_price.unit_amount) {
        needsUpdate.price_in_cents = expandedProduct.default_price.unit_amount
      }

      if (dbProduct.get('currency') !== expandedProduct.default_price.currency) {
        needsUpdate.currency = expandedProduct.default_price.currency
      }

      if (dbProduct.get('stripe_price_id') !== expandedProduct.default_price) {
        needsUpdate.stripe_price_id = expandedProduct.default_price
      }

      // Update our database if there are changes
      if (Object.keys(needsUpdate).length > 0) {
        await dbProduct.save(needsUpdate)
        if (process.env.NODE_ENV === 'development') {
          console.log(`Updated database record for product ${product.id}:`, needsUpdate)
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Database record for product ${product.id} is already in sync`)
        }
      }
    } catch (error) {
      console.error('Error handling product.updated:', error)
      throw error
    }
  },

  /**
   * Handle customer.subscription.created webhook events
   * Confirms subscription was created after checkout completes
   * Note: Initial access is typically granted by checkout.session.completed
   */
  handleSubscriptionCreated: async function (event) {
    try {
      const subscription = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Subscription created: ${subscription.id}`)
      }

      // Check if this subscription already has access records
      // (should exist if created via checkout.session.completed)
      const existingAccess = await ContentAccess.findBySubscriptionId(subscription.id)

      if (existingAccess && existingAccess.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Subscription ${subscription.id} already has ${existingAccess.length} access records (created via checkout)`)
        }
        return
      }

      // No access records exist - check if this is expected or an error
      // Try to get metadata from subscription first
      let offeringId = subscription.metadata?.offeringId
      let userId = subscription.metadata?.userId
      let sessionId = subscription.metadata?.sessionId

      // If metadata is missing, try to find the checkout session
      if (!offeringId || !userId) {
        const sessions = await stripe.checkout.sessions.list({
          subscription: subscription.id,
          limit: 1
        })

        if (sessions && sessions.data.length > 0) {
          const session = sessions.data[0]
          offeringId = offeringId || session.metadata?.offeringId
          userId = userId || session.metadata?.userId
          sessionId = sessionId || session.id
        }
      }

      if (!offeringId || !userId) {
        console.warn(`Subscription ${subscription.id} missing required metadata (offeringId: ${!!offeringId}, userId: ${!!userId}). Cannot validate or create access.`)
        return
      }

      // Find the offering to check if access grants are defined
      const offering = await StripeProduct.where({ id: offeringId }).fetch()
      if (!offering) {
        console.warn(`Offering ${offeringId} not found for subscription ${subscription.id}`)
        return
      }

      const accessGrants = offering.get('access_grants') || {}

      // If access_grants is empty, this is expected (e.g., voluntary contribution)
      if (Object.keys(accessGrants).length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Subscription ${subscription.id} has no access grants defined - this is expected for voluntary contributions`)
        }
        return
      }

      // Access grants exist but no access records - something went wrong!
      // Create the missing access records now
      console.warn(`Subscription ${subscription.id} should have access records but none exist. Creating now...`)

      const accessRecords = await offering.generateContentAccessRecords({
        userId: parseInt(userId, 10),
        sessionId: sessionId || subscription.id, // Use subscription ID if no session
        stripeSubscriptionId: subscription.id,
        metadata: {
          created_via_webhook: 'customer.subscription.created',
          subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString()
        }
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(`Created ${accessRecords.length} missing access records for subscription ${subscription.id}`)
      }

      // Grant group membership for any groups that received access
      const userIdNum = parseInt(userId, 10)
      const groupsToJoin = new Set()
      for (const accessRecord of accessRecords) {
        const accessGroupId = accessRecord.get('group_id')
        if (accessGroupId) {
          groupsToJoin.add(parseInt(accessGroupId, 10))
        }
      }

      for (const accessGroupId of groupsToJoin) {
        try {
          await GroupMembership.ensureMembership(userIdNum, accessGroupId, {
            role: GroupMembership.Role.DEFAULT
          })
          if (process.env.NODE_ENV === 'development') {
            console.log(`Ensured group membership for user ${userIdNum} in group ${accessGroupId}`)
          }
        } catch (error) {
          console.error(`Error ensuring membership for user ${userIdNum} in group ${accessGroupId}:`, error)
        }
      }
    } catch (error) {
      console.error('Error handling customer.subscription.created:', error)
      throw error
    }
  },

  /**
   * Handle customer.subscription.deleted webhook events
   * Expires access when subscription is canceled or ends
   */
  handleSubscriptionDeleted: async function (event) {
    try {
      const subscription = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Subscription deleted: ${subscription.id}`)
      }

      // Find content access records associated with this subscription
      const accessRecords = await ContentAccess.findBySubscriptionId(subscription.id)

      if (!accessRecords || accessRecords.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No content access records found for subscription ${subscription.id}`)
        }
        return
      }

      // Update all associated records to expired status
      await Promise.all(accessRecords.map(async (access) => {
        const metadata = access.get('metadata') || {}
        metadata.subscription_canceled_at = new Date().toISOString()
        metadata.subscription_cancel_reason = subscription.cancellation_details?.reason || 'Subscription ended'

        await access.save({
          status: ContentAccess.Status.EXPIRED,
          metadata
        })
      }))

      if (process.env.NODE_ENV === 'development') {
        console.log(`Expired ${accessRecords.length} access records for deleted subscription ${subscription.id}`)
      }
    } catch (error) {
      console.error('Error handling customer.subscription.deleted:', error)
      throw error
    }
  },

  /**
   * Handle invoice.paid webhook events
   * Extends access when subscription renewal payment succeeds
   */
  handleInvoicePaid: async function (event) {
    try {
      const invoice = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Invoice paid: ${invoice.id}`)
      }

      // Only handle invoices for subscriptions
      if (!invoice.subscription) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Invoice ${invoice.id} is not for a subscription, skipping`)
        }
        return
      }

      // Check if this is the first invoice (initial payment)
      // Initial payment is handled by checkout.session.completed
      if (invoice.billing_reason === 'subscription_create') {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Invoice ${invoice.id} is for initial subscription creation, already handled by checkout`)
        }
        return
      }

      const subscriptionId = invoice.subscription

      // Find content access records for this subscription
      const accessRecords = await ContentAccess.findBySubscriptionId(subscriptionId)

      if (!accessRecords || accessRecords.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No content access records found for subscription ${subscriptionId}`)
        }
        return
      }

      // Check renewal_policy from the offering
      const firstAccess = accessRecords.at(0)
      const productId = firstAccess.get('product_id')

      if (productId) {
        const offering = await StripeProduct.where({ id: productId }).fetch()

        if (offering && offering.get('renewal_policy') === StripeProduct.RenewalPolicy.MANUAL) {
          // This offering should not auto-renew
          console.warn(`Subscription ${subscriptionId} attempted to renew but offering ${productId} has renewal_policy='manual'. Canceling subscription.`)

          // Cancel the subscription at period end
          await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true
          })

          // Don't extend access - let it expire naturally
          if (process.env.NODE_ENV === 'development') {
            console.log(`Subscription ${subscriptionId} set to cancel at period end. Access will expire.`)
          }

          return
        }
      }

      // Get subscription details to get the new period end
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const newExpiresAt = new Date(subscription.current_period_end * 1000)

      // Extend access for all associated records
      await Promise.all(accessRecords.map(async (access) => {
        await ContentAccess.extendAccess(
          access.id,
          newExpiresAt,
          {
            renewed_at: new Date().toISOString(),
            invoice_id: invoice.id,
            subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            subscription_period_end: newExpiresAt.toISOString(),
            billing_reason: invoice.billing_reason
          }
        )
      }))

      if (process.env.NODE_ENV === 'development') {
        console.log(`Extended ${accessRecords.length} access records for subscription ${subscriptionId} until ${newExpiresAt.toISOString()}`)
      }
    } catch (error) {
      console.error('Error handling invoice.paid:', error)
      throw error
    }
  },

  /**
   * Handle invoice.payment_failed webhook events
   * Logs failed subscription renewal payments
   */
  handleInvoicePaymentFailed: async function (event) {
    try {
      const invoice = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Invoice payment failed: ${invoice.id}`)
      }

      // Only handle invoices for subscriptions
      if (!invoice.subscription) {
        return
      }

      const subscriptionId = invoice.subscription

      // Find content access records for this subscription
      const accessRecords = await ContentAccess.findBySubscriptionId(subscriptionId)

      if (!accessRecords || accessRecords.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No content access records found for subscription ${subscriptionId}`)
        }
        return
      }

      // Log the failed payment in metadata (don't revoke access yet - Stripe retries)
      await Promise.all(accessRecords.map(async (access) => {
        const metadata = access.get('metadata') || {}
        metadata.last_payment_failure = new Date().toISOString()
        metadata.last_payment_failure_invoice = invoice.id

        await access.save({ metadata })
      }))

      console.warn(`Payment failed for subscription ${subscriptionId} affecting ${accessRecords.length} access records. Stripe will retry payment.`)

      // TODO STRIPE: Send notification email to user about payment failure
    } catch (error) {
      console.error('Error handling invoice.payment_failed:', error)
      throw error
    }
  },

  /**
   * Handle charge.refunded webhook events
   * Revokes access when payment is refunded
   */
  handleChargeRefunded: async function (event) {
    try {
      const charge = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Charge refunded: ${charge.id}`)
      }

      // Get the payment intent to find the checkout session
      const paymentIntentId = charge.payment_intent
      if (!paymentIntentId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No payment intent found for charge ${charge.id}`)
        }
        return
      }

      // Retrieve the payment intent to get session_id from metadata
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      const sessionId = paymentIntent.metadata?.session_id

      if (!sessionId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No session_id found in payment intent metadata for ${paymentIntentId}`)
        }
        return
      }

      // Find content access records associated with this session
      const accessRecords = await ContentAccess.findBySessionId(sessionId)

      if (!accessRecords || accessRecords.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No content access records found for session ${sessionId}`)
        }
        return
      }

      // Revoke all associated access records
      await Promise.all(accessRecords.map(async (access) => {
        const metadata = access.get('metadata') || {}
        metadata.refunded_at = new Date().toISOString()
        metadata.refund_amount = charge.amount_refunded
        metadata.refund_reason = charge.refund?.reason || 'Payment refunded'

        await access.save({
          status: ContentAccess.Status.REVOKED,
          metadata
        })
      }))

      if (process.env.NODE_ENV === 'development') {
        console.log(`Revoked ${accessRecords.length} access records for refunded charge ${charge.id}`)
      }
    } catch (error) {
      console.error('Error handling charge.refunded:', error)
      throw error
    }
  },

  /**
   * Health check endpoint for Stripe integration
   *
   * Verifies that Stripe is properly configured
   *
   * GET /noo/stripe/health
   */
  health: function (req, res) {
    const hasStripeKey = !!process.env.STRIPE_SECRET_KEY

    return res.json({
      status: hasStripeKey ? 'configured' : 'not_configured',
      message: hasStripeKey
        ? 'Stripe is properly configured'
        : 'STRIPE_SECRET_KEY environment variable is not set',
      apiVersion: '2025-09-30.clover'
    })
  }
}
