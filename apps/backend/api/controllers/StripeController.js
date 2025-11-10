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

/* global StripeAccount */

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

        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event)
          break

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event)
          break

        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event)
          break

        case 'product.updated':
          await this.handleProductUpdated(event)
          break

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event)
          break

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event)
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
   * Handle payment_intent.succeeded webhook events
   * Grants access to content when payment is successful
   */
  handlePaymentIntentSucceeded: async function (event) {
    try {
      const paymentIntent = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Payment succeeded: ${paymentIntent.id}`)
      }

      // Get the checkout session to find the product and user info
      const sessionId = paymentIntent.metadata?.session_id
      if (!sessionId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No session_id found in payment intent metadata: ${paymentIntent.id}`)
        }
        return
      }

      // Retrieve the checkout session
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items']
      })

      if (!session) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No checkout session found: ${sessionId}`)
        }
        return
      }

      // Extract user and product info from session metadata
      const userId = session.metadata?.userId
      const groupId = session.metadata?.groupId
      const accountId = session.metadata?.accountId

      if (!userId || !groupId || !accountId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Missing required metadata in session ${sessionId}:`, {
            userId: !!userId,
            groupId: !!groupId,
            accountId: !!accountId
          })
        }
        return
      }

      // Find the Stripe product for this purchase
      const lineItem = session.line_items?.data?.[0]
      if (!lineItem) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No line items found in session: ${sessionId}`)
        }
        return
      }

      const product = await StripeProduct.findByStripeId(lineItem.price.product)
      if (!product) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No product found for Stripe product ID: ${lineItem.price.product}`)
        }
        return
      }

      // Generate content access records
      const accessRecords = await product.generateContentAccessRecords({
        userId: parseInt(userId, 10),
        sessionId,
        paymentIntentId: paymentIntent.id,
        metadata: {
          paymentAmount: paymentIntent.amount,
          currency: paymentIntent.currency,
          purchasedAt: new Date().toISOString()
        }
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(`Created ${accessRecords.length} content access records for user ${userId}`)
      }

      // TODO STRIPE: Send confirmation email to user
      // TODO STRIPE: Send notification to group admins
    } catch (error) {
      console.error('Error handling payment_intent.succeeded:', error)
      throw error
    }
  },

  /**
   * Handle payment_intent.payment_failed webhook events
   * Notifies user and logs failed payments
   * TODO STRIPE: This needs to actually log to somewhere specific, and otherwise be more useful. Need to be able to access the checkout session from stripe
   */
  handlePaymentIntentFailed: async function (event) {
    try {
      const paymentIntent = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Payment failed: ${paymentIntent.id}`)
      }

      // Get the checkout session to find user info
      const sessionId = paymentIntent.metadata?.session_id
      if (!sessionId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No session_id found in failed payment intent metadata: ${paymentIntent.id}`)
        }
        return
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId)
      const userId = session.metadata?.userId

      if (userId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Payment failed for user ${userId}, session ${sessionId}`)
        }
        // TODO STRIPE: Send failure notification email to user
        // TODO STRIPE: Log for analytics
      }
    } catch (error) {
      console.error('Error handling payment_intent.payment_failed:', error)
      throw error
    }
  },

  /**
   * Handle checkout.session.completed webhook events
   * Final verification that checkout completed successfully
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

      // The actual access granting is handled by payment_intent.succeeded
      // This is just for logging and verification
      if (process.env.NODE_ENV === 'development') {
        console.log(`Checkout session ${session.id} completed successfully`)
      }
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
   * Handle customer.subscription.updated webhook events
   * Extends access when subscription renews
   */
  handleSubscriptionUpdated: async function (event) {
    try {
      const subscription = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Subscription updated: ${subscription.id}`)
      }

      // Only handle active subscriptions
      if (subscription.status !== 'active') {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Subscription ${subscription.id} is not active (status: ${subscription.status}), skipping`)
        }
        return
      }

      // Find content access records associated with this subscription
      // Note: We need to store subscription ID in metadata during initial purchase
      const accessRecords = await ContentAccess.where('metadata', '@>', JSON.stringify({
        stripe_subscription_id: subscription.id
      })).fetchAll()

      if (!accessRecords || accessRecords.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No content access records found for subscription ${subscription.id}`)
        }
        return
      }

      // Calculate new expiration date from subscription's current period end
      const newExpiresAt = new Date(subscription.current_period_end * 1000)

      // Extend access for all associated records
      await Promise.all(accessRecords.map(async (access) => {
        await ContentAccess.extendAccess(
          access.id,
          newExpiresAt,
          {
            subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            subscription_period_end: newExpiresAt.toISOString(),
            renewed_via_webhook: true
          }
        )
      }))

      if (process.env.NODE_ENV === 'development') {
        console.log(`Extended ${accessRecords.length} access records for subscription ${subscription.id}`)
      }
    } catch (error) {
      console.error('Error handling customer.subscription.updated:', error)
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
      const accessRecords = await ContentAccess.where('metadata', '@>', JSON.stringify({
        stripe_subscription_id: subscription.id
      })).fetchAll()

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
   * Handle charge.refunded webhook events
   * Revokes access when payment is refunded
   */
  handleChargeRefunded: async function (event) {
    try {
      const charge = event.data.object
      if (process.env.NODE_ENV === 'development') {
        console.log(`Charge refunded: ${charge.id}`)
      }

      // Find the payment intent to get the session ID
      const paymentIntentId = charge.payment_intent
      if (!paymentIntentId) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No payment intent found for charge ${charge.id}`)
        }
        return
      }

      // Find content access records associated with this payment intent
      const accessRecords = await ContentAccess.findByPaymentIntentId(paymentIntentId)

      if (!accessRecords || accessRecords.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No content access records found for payment intent ${paymentIntentId}`)
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
