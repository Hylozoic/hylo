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
const { en } = require('../../lib/i18n/en')
const { es } = require('../../lib/i18n/es')
const locales = { en, es }

/* global bookshelf, StripeAccount, StripeProduct, ContentAccess, GroupMembership, Group, User, Track, Frontend */

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

      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('STRIPE_WEBHOOK_SECRET environment variable is not set')
        return res.status(500).json({ error: 'Webhook secret not configured' })
      }

      // Verify webhook signature
      // req.body should be a Buffer from bodyParser.raw() middleware
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
      // Use module.exports to access handler methods (this context is lost in Sails controllers)
      const handlers = module.exports
      switch (event.type) {
        case 'account.updated':
          await handlers.handleAccountUpdated(event)
          break

        case 'checkout.session.completed':
          await handlers.handleCheckoutSessionCompleted(event)
          break

        case 'product.updated':
          await handlers.handleProductUpdated(event)
          break

        case 'customer.subscription.created':
          await handlers.handleSubscriptionCreated(event)
          break

        case 'customer.subscription.updated':
          await handlers.handleSubscriptionUpdated(event)
          break

        case 'customer.subscription.deleted':
          await handlers.handleSubscriptionDeleted(event)
          break

        case 'invoice.paid':
          await handlers.handleInvoicePaid(event)
          break

        case 'invoice.payment_failed':
          await handlers.handleInvoicePaymentFailed(event)
          break

        case 'charge.refunded':
          await handlers.handleChargeRefunded(event)
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

      // Ensure user is a member of all groups that received access and pin to nav
      for (const accessGroupId of groupsToJoin) {
        try {
          const membership = await GroupMembership.ensureMembership(userIdNum, accessGroupId, {
            role: GroupMembership.Role.DEFAULT
          })

          // Record agreement acceptance - user accepted agreements before purchase
          if (membership) {
            await membership.acceptAgreements()
          }

          // Pin the purchased group to the user's global navigation
          await GroupMembership.pinGroupToNav(userIdNum, accessGroupId)

          if (process.env.NODE_ENV === 'development') {
            console.log(`Ensured group membership for user ${userIdNum} in group ${accessGroupId}`)
          }
        } catch (error) {
          console.error(`Error ensuring membership for user ${userIdNum} in group ${accessGroupId}:`, error)
          // Continue processing other groups even if one fails
        }
      }

      // Handle donation transfer if customer added optional donation item
      // Check line items for donation to Hylo
      let donationAmount = 0
      try {
        // Get the group to find the connected account ID first
        const group = await Group.find(groupId)
        if (group) {
          const stripeAccountId = group.get('stripe_account_id')
          if (stripeAccountId) {
            // Convert database ID to external account ID if needed
            const getExternalAccountId = async (accountId) => {
              if (accountId && accountId.startsWith('acct_')) {
                return accountId
              }
              const StripeAccount = bookshelf.model('StripeAccount')
              const stripeAccount = await StripeAccount.where({ id: accountId }).fetch()
              if (!stripeAccount) {
                throw new Error('Stripe account record not found')
              }
              return stripeAccount.get('stripe_account_external_id')
            }

            const externalAccountId = await getExternalAccountId(stripeAccountId)

            // Retrieve full session with line items expanded to check for donations
            const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
              expand: ['line_items']
            }, {
              stripeAccount: externalAccountId
            })

            // Look for donation line items in the session
            // Track donation details for acknowledgment email
            const donationDetails = {
              isRecurring: false,
              recurringInterval: null,
              donationType: 'one-time'
            }

            // Sum all donations (one-time and recurring) in case customer added both
            if (fullSession.line_items?.data) {
              for (const lineItem of fullSession.line_items.data) {
                const productName = lineItem.price?.product?.name || lineItem.description || ''
                const isDonation = productName.toLowerCase().includes('donation to hylo')

                if (isDonation) {
                  // Calculate donation amount: unit_amount * quantity
                  const itemDonationAmount = (lineItem.price.unit_amount || 0) * (lineItem.quantity || 0)
                  donationAmount += itemDonationAmount

                  // Track donation type and recurring details
                  const isRecurring = lineItem.price?.recurring !== null && lineItem.price?.recurring !== undefined
                  if (isRecurring) {
                    donationDetails.isRecurring = true
                    donationDetails.donationType = 'recurring'
                    // Map Stripe interval to template format
                    const interval = lineItem.price.recurring.interval
                    if (interval === 'month') {
                      donationDetails.recurringInterval = 'monthly'
                    } else if (interval === 'year') {
                      donationDetails.recurringInterval = 'annually'
                    } else if (interval === 'week') {
                      donationDetails.recurringInterval = 'weekly'
                    } else if (interval === 'day') {
                      donationDetails.recurringInterval = 'daily'
                    } else {
                      donationDetails.recurringInterval = interval
                    }
                  }

                  if (process.env.NODE_ENV === 'development') {
                    console.log(`Found ${isRecurring ? 'recurring' : 'one-time'} donation: ${itemDonationAmount} ${session.currency || 'usd'}`)
                  }
                }
              }
            }

            // Transfer donation if present
            if (donationAmount > 0) {
              const paymentIntentId = session.payment_intent

              if (paymentIntentId) {
                await StripeService.transferDonationToPlatform({
                  connectedAccountId: externalAccountId,
                  paymentIntentId,
                  donationAmount,
                  currency: session.currency || 'usd'
                })

                if (process.env.NODE_ENV === 'development') {
                  console.log(`Transferred donation of ${donationAmount} ${session.currency || 'usd'} to platform`)
                }

                // Send Donation Acknowledgment email
                try {
                  const user = await User.find(userId)
                  if (user && user.get('email')) {
                    const userLocale = user.getLocale()
                    const donationDate = new Date(session.created * 1000)
                    const donationDateFormatted = donationDate.toLocaleDateString(
                      userLocale === 'es' ? 'es-ES' : 'en-US',
                      {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }
                    )

                    const donationAmountFormatted = StripeService.formatPrice(donationAmount, session.currency || 'usd')

                    // Get group and offering info for context
                    const group = await Group.find(groupId)
                    const offering = await StripeProduct.where({ id: offeringId }).fetch()
                    let purchaseContext = null
                    if (offering) {
                      purchaseContext = offering.get('name')
                    }

                    // Determine next donation date for recurring donations
                    let nextDonationDate = null
                    if (donationDetails.isRecurring && donationDetails.recurringInterval) {
                      const nextDate = new Date(donationDate)
                      if (donationDetails.recurringInterval === 'monthly') {
                        nextDate.setMonth(nextDate.getMonth() + 1)
                      } else if (donationDetails.recurringInterval === 'annually') {
                        nextDate.setFullYear(nextDate.getFullYear() + 1)
                      } else if (donationDetails.recurringInterval === 'weekly') {
                        nextDate.setDate(nextDate.getDate() + 7)
                      } else if (donationDetails.recurringInterval === 'daily') {
                        nextDate.setDate(nextDate.getDate() + 1)
                      }
                      nextDonationDate = nextDate.toLocaleDateString(
                        userLocale === 'es' ? 'es-ES' : 'en-US',
                        {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }
                      )
                    }

                    // Fiscal sponsor info (use env var or default)
                    const fiscalSponsorName = process.env.FISCAL_SPONSOR_NAME || 'our fiscal sponsor'
                    const localeObj = locales[userLocale] || locales.en
                    const taxReceiptInfo = localeObj.donationTaxReceiptInfo()
                    const impactMessage = donationDetails.isRecurring
                      ? localeObj.donationRecurringImpactMessage()
                      : localeObj.donationImpactMessage()

                    const emailData = {
                      user_name: user.get('name'),
                      donation_amount: donationAmountFormatted,
                      donation_type: donationDetails.donationType,
                      donation_date: donationDateFormatted,
                      is_tax_deductible: true,
                      fiscal_sponsor_name: fiscalSponsorName,
                      tax_receipt_info: taxReceiptInfo,
                      is_recurring: donationDetails.isRecurring,
                      impact_message: impactMessage
                    }

                    if (donationDetails.isRecurring) {
                      emailData.next_donation_date = nextDonationDate
                      emailData.recurring_interval = donationDetails.recurringInterval
                      emailData.manage_donation_url = `${process.env.FRONTEND_URL || 'https://hylo.com'}/settings/subscriptions`
                    }

                    if (purchaseContext) {
                      emailData.purchase_context = purchaseContext
                    }

                    if (group) {
                      emailData.group_name = group.get('name')
                    }

                    Queue.classMethod('Email', 'sendDonationAcknowledgment', {
                      email: user.get('email'),
                      data: emailData,
                      version: 'Redesign 2025',
                      locale: userLocale
                    })

                    if (process.env.NODE_ENV === 'development') {
                      console.log(`Queued Donation Acknowledgment email to user ${userId}`)
                    }
                  }
                } catch (emailError) {
                  // Log error but don't fail the entire webhook - email can be retried
                  console.error('Error queueing donation acknowledgment email:', emailError)
                }
              }
            }
          }
        }
      } catch (donationError) {
        // Log error but don't fail the entire webhook - donation transfer can be retried
        console.error('Error processing donation transfer:', donationError)
      }

      // Send purchase confirmation email to user
      try {
        const user = await User.find(userId)
        if (!user || !user.get('email')) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`User ${userId} not found or has no email, skipping purchase confirmation email`)
          }
        } else {
          const group = await Group.find(groupId)
          if (!group) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`Group ${groupId} not found, skipping purchase confirmation email`)
            }
          } else {
            const userLocale = user.getLocale()
            const isSubscription = session.mode === 'subscription' && stripeSubscriptionId
            const trackId = offering.get('track_id')
            const isTrackPurchase = !!trackId

            // Format purchase date
            const purchaseDate = new Date(session.created * 1000)
            const formattedPurchaseDate = purchaseDate.toLocaleDateString(userLocale === 'es' ? 'es-ES' : 'en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })

            // Format price
            const priceFormatted = StripeService.formatPrice(session.amount_total, session.currency || 'usd')

            // Determine access type
            let accessType = 'group'
            if (isTrackPurchase) {
              accessType = 'track'
            } else if (offering.get('access_grants')) {
              // Check access_grants to determine type
              const accessGrants = typeof offering.get('access_grants') === 'string'
                ? JSON.parse(offering.get('access_grants'))
                : offering.get('access_grants')
              if (accessGrants?.trackIds && accessGrants.trackIds.length > 0) {
                accessType = 'track'
              } else if (accessGrants?.groupIds && accessGrants.groupIds.length > 1) {
                accessType = 'bundle'
              }
            }

            // Get track info if track purchase
            let track = null
            let trackName = null
            let trackUrl = null
            if (isTrackPurchase && trackId) {
              track = await Track.find(trackId)
              if (track) {
                trackName = track.get('name')
                trackUrl = Frontend.Route.track(track, group)
              }
            }

            // Get subscription info if subscription
            let renewalDate = null
            let renewalPeriod = null
            let manageSubscriptionUrl = null
            if (isSubscription && stripeSubscriptionId) {
              try {
                const stripeAccountId = group.get('stripe_account_id')
                const getExternalAccountId = async (accountId) => {
                  if (accountId && accountId.startsWith('acct_')) {
                    return accountId
                  }
                  const StripeAccount = bookshelf.model('StripeAccount')
                  const stripeAccount = await StripeAccount.where({ id: accountId }).fetch()
                  if (!stripeAccount) {
                    throw new Error('Stripe account record not found')
                  }
                  return stripeAccount.get('stripe_account_external_id')
                }

                const externalAccountId = stripeAccountId ? await getExternalAccountId(stripeAccountId) : null

                const subscription = await stripe.subscriptions.retrieve(
                  stripeSubscriptionId,
                  {},
                  externalAccountId
                    ? { stripeAccount: externalAccountId }
                    : {}
                )

                if (subscription.current_period_end) {
                  const renewalDateObj = new Date(subscription.current_period_end * 1000)
                  renewalDate = renewalDateObj.toLocaleDateString(userLocale === 'es' ? 'es-ES' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                }

                // Map subscription interval to renewal period
                if (subscription.items?.data?.[0]?.price?.recurring) {
                  const interval = subscription.items.data[0].price.recurring.interval
                  const intervalCount = subscription.items.data[0].price.recurring.interval_count || 1

                  if (interval === 'month') {
                    renewalPeriod = intervalCount === 1 ? 'monthly' : `${intervalCount}-month`
                  } else if (interval === 'year') {
                    renewalPeriod = intervalCount === 1 ? 'annual' : `${intervalCount}-year`
                  } else if (interval === 'week') {
                    renewalPeriod = intervalCount === 1 ? 'weekly' : `${intervalCount}-week`
                  } else {
                    renewalPeriod = interval
                  }
                }

                // Generate manage subscription URL (Stripe customer portal or Hylo settings)
                manageSubscriptionUrl = `${process.env.FRONTEND_URL || 'https://hylo.com'}/settings/subscriptions`
              } catch (subError) {
                console.error('Error fetching subscription details for email:', subError)
                // Continue without subscription details
              }
            }

            // Get receipt URL
            let stripeReceiptUrl = null
            if (session.invoice) {
              try {
                const invoice = await stripe.invoices.retrieve(session.invoice)
                stripeReceiptUrl = invoice.hosted_invoice_url || invoice.invoice_pdf
              } catch (invoiceError) {
                // Receipt URL is optional, continue without it
                if (process.env.NODE_ENV === 'development') {
                  console.log('Could not retrieve receipt URL:', invoiceError.message)
                }
              }
            }

            // Check if this is a track purchase - if so, send Track Access Purchased email instead
            if (isTrackPurchase && track) {
              // Queue Track Access Purchased email
              const isEnrolled = accessRecords.some(ar => ar.get('track_id') === trackId)

              Queue.classMethod('Email', 'sendTrackAccessPurchased', {
                email: user.get('email'),
                data: {
                  user_name: user.get('name'),
                  track_name: trackName,
                  track_description: track.get('description'),
                  track_url: trackUrl,
                  track_image_url: track.get('image_url') || group.get('avatar_url'),
                  group_name: group.get('name'),
                  group_url: Frontend.Route.group(group),
                  offering_name: offering.get('name'),
                  price_formatted: priceFormatted,
                  purchase_date: formattedPurchaseDate,
                  is_enrolled: isEnrolled,
                  start_learning_url: isEnrolled ? `${trackUrl}/actions` : trackUrl,
                  group_avatar_url: group.get('avatar_url')
                },
                version: 'Redesign 2025',
                locale: userLocale
              })

              if (process.env.NODE_ENV === 'development') {
                console.log(`Queued Track Access Purchased email to user ${userId}`)
              }
            } else {
              // Queue Purchase Confirmation email
              const emailData = {
                user_name: user.get('name'),
                offering_name: offering.get('name'),
                offering_description: offering.get('description'),
                price_formatted: priceFormatted,
                currency: (session.currency || 'usd').toUpperCase(),
                purchase_date: formattedPurchaseDate,
                access_type: accessType,
                group_name: group.get('name'),
                group_url: Frontend.Route.group(group),
                is_subscription: isSubscription,
                group_avatar_url: group.get('avatar_url')
              }

              // Add track info if applicable
              if (track && trackName && trackUrl) {
                emailData.track_name = trackName
                emailData.track_url = trackUrl
              }

              // Add subscription info if applicable
              if (isSubscription) {
                if (renewalDate) emailData.renewal_date = renewalDate
                if (renewalPeriod) emailData.renewal_period = renewalPeriod
                if (manageSubscriptionUrl) emailData.manage_subscription_url = manageSubscriptionUrl
              } else {
                // Check if one-time purchase has expiration
                const duration = offering.get('duration')
                if (duration && duration !== 'lifetime') {
                  // Calculate expiration date based on duration
                  const expiresAtDate = new Date(purchaseDate)
                  if (duration === 'day') {
                    expiresAtDate.setDate(expiresAtDate.getDate() + 1)
                  } else if (duration === 'month') {
                    expiresAtDate.setMonth(expiresAtDate.getMonth() + 1)
                  } else if (duration === 'season') {
                    expiresAtDate.setMonth(expiresAtDate.getMonth() + 3)
                  } else if (duration === 'annual') {
                    expiresAtDate.setFullYear(expiresAtDate.getFullYear() + 1)
                  }
                  emailData.expires_at = expiresAtDate.toLocaleDateString(userLocale === 'es' ? 'es-ES' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                }
              }

              // Add receipt URL if available
              if (stripeReceiptUrl) {
                emailData.stripe_receipt_url = stripeReceiptUrl
              }

              Queue.classMethod('Email', 'sendPurchaseConfirmation', {
                email: user.get('email'),
                data: emailData,
                version: 'Redesign 2025',
                locale: userLocale
              })

              if (process.env.NODE_ENV === 'development') {
                console.log(`Queued Purchase Confirmation email to user ${userId}`)
              }
            }
          }
        }
      } catch (emailError) {
        // Log error but don't fail the entire webhook - email queuing can be retried
        console.error('Error queueing purchase confirmation email:', emailError)
      }

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
          const membership = await GroupMembership.ensureMembership(userIdNum, accessGroupId, {
            role: GroupMembership.Role.DEFAULT
          })

          // Record agreement acceptance - user accepted agreements before purchase
          if (membership) {
            await membership.acceptAgreements()
          }

          // Pin the purchased group to the user's global navigation
          await GroupMembership.pinGroupToNav(userIdNum, accessGroupId)

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
   * Handle customer.subscription.updated webhook events
   * Updates content access records when subscription status changes
   * (e.g., when subscription is set to cancel at period end)
   */
  handleSubscriptionUpdated: async function (event) {
    try {
      const subscription = event.data.object
      // Determine if subscription is scheduled to be cancelled
      // Stripe has two cancellation modes:
      // 1. cancel_at_period_end: true - Cancel at end of billing period
      // 2. cancel_at: <timestamp> - Cancel at a specific date
      const isScheduledToCancel = subscription.cancel_at_period_end || subscription.cancel_at !== null
      const cancelAt = subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000)
        : (subscription.cancel_at_period_end ? new Date(subscription.current_period_end * 1000) : null)

      if (process.env.NODE_ENV === 'development') {
        console.log(`Subscription updated: ${subscription.id}`, {
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          cancel_at: subscription.cancel_at,
          isScheduledToCancel,
          cancelAt
        })
      }

      // Find content access records associated with this subscription
      const accessRecords = await ContentAccess.findBySubscriptionId(subscription.id)

      if (!accessRecords || accessRecords.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`No content access records found for subscription ${subscription.id}`)
        }
        return
      }

      // Check if subscription is scheduled to be cancelled (either mode)
      if (isScheduledToCancel) {
        // Subscription has been set to cancel at period end
        // Keep status as ACTIVE (access continues until period end)
        // But update metadata to indicate cancellation is scheduled
        await Promise.all(accessRecords.map(async (access) => {
          const existingMetadata = access.get('metadata') || {}
          const updatedMetadata = {
            ...existingMetadata,
            subscription_cancellation_scheduled_at: new Date().toISOString(),
            subscription_cancel_at_period_end: true,
            subscription_period_end: cancelAt.toISOString(),
            subscription_cancel_reason: subscription.cancellation_details?.reason || 'User requested cancellation'
          }

          if (process.env.NODE_ENV === 'development') {
            console.log(`Updating content_access ${access.id} with cancellation metadata:`, {
              metadata_before: existingMetadata,
              metadata_after: updatedMetadata
            })
          }

          // Update using raw knex to ensure JSONB is properly updated
          await bookshelf.knex('content_access')
            .where({ id: access.id })
            .update({
              metadata: JSON.stringify(updatedMetadata),
              updated_at: new Date()
            })

          if (process.env.NODE_ENV === 'development') {
            console.log(`Successfully updated content_access ${access.id}`)
          }
        }))

        if (process.env.NODE_ENV === 'development') {
          console.log(`Marked ${accessRecords.length} access records for subscription ${subscription.id} as scheduled to cancel at ${cancelAt.toISOString()}`)
        }
      } else if (subscription.status === 'active' && !isScheduledToCancel) {
        // Subscription was reactivated (cancellation was undone)
        // Only clear metadata if it was previously set
        await Promise.all(accessRecords.map(async (access) => {
          const existingMetadata = access.get('metadata') || {}
          const hadCancellationMetadata = existingMetadata.subscription_cancel_at_period_end

          if (hadCancellationMetadata) {
            // Create a new metadata object without cancellation fields
            const updatedMetadata = { ...existingMetadata }
            delete updatedMetadata.subscription_cancellation_scheduled_at
            delete updatedMetadata.subscription_cancel_at_period_end
            delete updatedMetadata.subscription_cancel_reason
            delete updatedMetadata.subscription_period_end

            if (process.env.NODE_ENV === 'development') {
              console.log(`Clearing cancellation metadata from content_access ${access.id}:`, {
                metadata_before: existingMetadata,
                metadata_after: updatedMetadata
              })
            }

            // Update using raw knex to ensure JSONB is properly updated
            await bookshelf.knex('content_access')
              .where({ id: access.id })
              .update({
                metadata: JSON.stringify(updatedMetadata),
                updated_at: new Date()
              })

            if (process.env.NODE_ENV === 'development') {
              console.log(`Successfully cleared metadata from content_access ${access.id}`)
            }
          }
        }))

        if (process.env.NODE_ENV === 'development') {
          console.log(`Cleared cancellation metadata for ${accessRecords.length} access records - subscription ${subscription.id} reactivated (status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end})`)
        }
      } else {
        // Subscription status changed but not to cancel_at_period_end or reactivated
        // Log for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log(`Subscription ${subscription.id} updated but no action taken (status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end})`)
        }
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

      // Send Subscription Cancelled email
      try {
        const firstAccess = accessRecords.at(0)
        const userId = firstAccess.get('user_id')
        const productId = firstAccess.get('product_id')
        const groupId = firstAccess.get('granted_by_group_id')

        const user = await User.find(userId)
        const offering = await StripeProduct.where({ id: productId }).fetch()
        const group = await Group.find(groupId)

        if (!user || !offering || !group) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Missing user, offering, or group for subscription cancelled email. Skipping.')
          }
        } else {
          const userLocale = user.getLocale()
          const cancelledAt = new Date()
          const cancelledAtFormatted = cancelledAt.toLocaleDateString(
            userLocale === 'es' ? 'es-ES' : 'en-US',
            {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }
          )

          // Determine when access ends
          // If cancelled at period end, access ends at current_period_end
          // If immediate cancellation, access ends now
          let accessEndsAt = cancelledAt
          if (subscription.canceled_at && subscription.current_period_end) {
            // Check if cancellation was scheduled (cancel_at_period_end was true)
            // In that case, access ends at period end
            const canceledAtTimestamp = subscription.canceled_at * 1000
            const periodEndTimestamp = subscription.current_period_end * 1000
            if (periodEndTimestamp > canceledAtTimestamp) {
              // Cancellation was scheduled, access ends at period end
              accessEndsAt = new Date(periodEndTimestamp)
            }
          }

          const accessEndsAtFormatted = accessEndsAt.toLocaleDateString(
            userLocale === 'es' ? 'es-ES' : 'en-US',
            {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }
          )

          // Get cancellation reason
          let reason = null
          if (subscription.cancellation_details?.reason) {
            reason = subscription.cancellation_details.reason
          } else if (subscription.cancellation_details?.feedback) {
            reason = subscription.cancellation_details.feedback
          }

          const emailData = {
            user_name: user.get('name'),
            offering_name: offering.get('name'),
            group_name: group.get('name'),
            group_url: Frontend.Route.group(group),
            cancelled_at: cancelledAtFormatted,
            access_ends_at: accessEndsAtFormatted,
            resubscribe_url: Frontend.Route.group(group),
            group_avatar_url: group.get('avatar_url')
          }

          if (reason) {
            emailData.reason = reason
          }

          Queue.classMethod('Email', 'sendSubscriptionCancelled', {
            email: user.get('email'),
            data: emailData,
            version: 'Redesign 2025',
            locale: userLocale
          })

          if (process.env.NODE_ENV === 'development') {
            console.log(`Queued Subscription Cancelled email to user ${userId}`)
          }

          // Send Admin Notification emails to all admins/stewards
          try {
            // Get all admins with RESP_ADMINISTRATION (ID = 1)
            const admins = await group.membersWithResponsibilities([Responsibility.Common.RESP_ADMINISTRATION]).fetchAll()

            if (admins && admins.length > 0) {
              // Determine cancellation type
              const cancellationType = accessEndsAt > cancelledAt ? 'at_period_end' : 'immediate'

              // Get subscription amount and period from offering
              const priceInCents = offering.get('price_in_cents') || 0
              const currency = offering.get('currency') || 'usd'
              const subscriptionAmount = StripeService.formatPrice(priceInCents, currency)

              const duration = offering.get('duration')
              let subscriptionPeriod = null
              if (duration === 'day') {
                subscriptionPeriod = 'daily'
              } else if (duration === 'month') {
                subscriptionPeriod = 'monthly'
              } else if (duration === 'season') {
                subscriptionPeriod = 'quarterly'
              } else if (duration === 'annual') {
                subscriptionPeriod = 'annual'
              } else if (duration) {
                subscriptionPeriod = duration
              }

              // Send email to each admin individually
              await Promise.all(admins.models.map(async (adminMembership) => {
                const admin = adminMembership.relations.user || await User.find(adminMembership.get('user_id'))
                if (!admin) return

                const adminLocale = admin.getLocale()

                const cancelledAtFormattedForAdmin = cancelledAt.toLocaleDateString(
                  adminLocale === 'es' ? 'es-ES' : 'en-US',
                  {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }
                )

                const accessEndsAtFormattedForAdmin = accessEndsAt.toLocaleDateString(
                  adminLocale === 'es' ? 'es-ES' : 'en-US',
                  {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }
                )

                const adminEmailData = {
                  admin_name: admin.get('name'),
                  user_name: user.get('name'),
                  user_email: user.get('email'),
                  user_profile_url: Frontend.Route.profile(user),
                  offering_name: offering.get('name'),
                  group_name: group.get('name'),
                  group_url: Frontend.Route.group(group),
                  cancelled_at: cancelledAtFormattedForAdmin,
                  access_ends_at: accessEndsAtFormattedForAdmin,
                  cancellation_type: cancellationType,
                  subscription_amount: subscriptionAmount,
                  subscription_period: subscriptionPeriod,
                  revenue_lost: subscriptionAmount,
                  view_content_access_url: `${process.env.FRONTEND_URL || 'https://hylo.com'}/groups/${group.get('slug') || group.id}/settings/paid-content/access`,
                  contact_user_url: `${Frontend.Route.profile(user)}/message`,
                  group_avatar_url: group.get('avatar_url')
                }

                if (reason) {
                  adminEmailData.reason = reason
                }

                Queue.classMethod('Email', 'sendSubscriptionCancelledAdminNotification', {
                  email: admin.get('email'),
                  data: adminEmailData,
                  version: 'Redesign 2025',
                  locale: adminLocale
                })

                if (process.env.NODE_ENV === 'development') {
                  console.log(`Queued Subscription Cancelled Admin Notification email to admin ${admin.id}`)
                }
              }))
            }
          } catch (adminEmailError) {
            // Log error but don't fail the entire webhook - email can be retried
            console.error('Error queueing subscription cancelled admin notification emails:', adminEmailError)
          }
        }
      } catch (emailError) {
        // Log error but don't fail the entire webhook - email can be retried
        console.error('Error queueing subscription cancelled email:', emailError)
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

      // Send Subscription Renewed email
      try {
        const firstAccess = accessRecords.at(0)
        const userId = firstAccess.get('user_id')
        const productId = firstAccess.get('product_id')
        const groupId = firstAccess.get('granted_by_group_id')

        const user = await User.find(userId)
        const offering = await StripeProduct.where({ id: productId }).fetch()
        const group = await Group.find(groupId)

        if (!user || !offering || !group) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Missing user, offering, or group for subscription renewal email. Skipping.')
          }
        } else {
          const userLocale = user.getLocale()
          const paymentDate = new Date(invoice.created * 1000)
          const paymentDateFormatted = paymentDate.toLocaleDateString(
            userLocale === 'es' ? 'es-ES' : 'en-US',
            {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }
          )

          const nextRenewalDateFormatted = newExpiresAt.toLocaleDateString(
            userLocale === 'es' ? 'es-ES' : 'en-US',
            {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }
          )

          const amountPaid = StripeService.formatPrice(invoice.amount_paid, invoice.currency || 'usd')

          // Get receipt URL
          let stripeReceiptUrl = null
          if (invoice.hosted_invoice_url) {
            stripeReceiptUrl = invoice.hosted_invoice_url
          } else if (invoice.invoice_pdf) {
            stripeReceiptUrl = invoice.invoice_pdf
          }

          const emailData = {
            user_name: user.get('name'),
            offering_name: offering.get('name'),
            group_name: group.get('name'),
            group_url: Frontend.Route.group(group),
            amount_paid: amountPaid,
            payment_date: paymentDateFormatted,
            next_renewal_date: nextRenewalDateFormatted,
            manage_subscription_url: `${process.env.FRONTEND_URL || 'https://hylo.com'}/settings/subscriptions`,
            group_avatar_url: group.get('avatar_url')
          }

          if (stripeReceiptUrl) {
            emailData.stripe_receipt_url = stripeReceiptUrl
          }

          Queue.classMethod('Email', 'sendSubscriptionRenewed', {
            email: user.get('email'),
            data: emailData,
            version: 'Redesign 2025',
            locale: userLocale
          })

          if (process.env.NODE_ENV === 'development') {
            console.log(`Queued Subscription Renewed email to user ${userId}`)
          }
        }
      } catch (emailError) {
        // Log error but don't fail the entire webhook - email can be retried
        console.error('Error queueing subscription renewed email:', emailError)
      }

      // Handle recurring donations from subscription renewal invoices
      // Check invoice line items for recurring donations
      let donationAmount = 0
      try {
        // Get group ID from the first access record to find connected account
        const firstAccess = accessRecords.at(0)
        const productId = firstAccess.get('product_id')

        if (productId) {
          const offering = await StripeProduct.where({ id: productId }).fetch()
          if (offering) {
            const groupId = offering.get('group_id')
            const group = await Group.find(groupId)

            if (group) {
              const stripeAccountId = group.get('stripe_account_id')
              if (stripeAccountId) {
                // Convert database ID to external account ID if needed
                const getExternalAccountId = async (accountId) => {
                  if (accountId && accountId.startsWith('acct_')) {
                    return accountId
                  }
                  const StripeAccount = bookshelf.model('StripeAccount')
                  const stripeAccount = await StripeAccount.where({ id: accountId }).fetch()
                  if (!stripeAccount) {
                    throw new Error('Stripe account record not found')
                  }
                  return stripeAccount.get('stripe_account_external_id')
                }

                const externalAccountId = await getExternalAccountId(stripeAccountId)

                // Retrieve invoice with line items expanded
                const fullInvoice = await stripe.invoices.retrieve(invoice.id, {
                  expand: ['lines.data.price.product']
                }, {
                  stripeAccount: externalAccountId
                })

                // Look for recurring donation line items in the invoice
                // Track donation details for acknowledgment email
                const donationDetails = {
                  isRecurring: true,
                  recurringInterval: null,
                  donationType: 'recurring'
                }

                if (fullInvoice.lines?.data) {
                  for (const lineItem of fullInvoice.lines.data) {
                    const productName = lineItem.price?.product?.name || lineItem.description || ''
                    const isRecurringDonation = productName.toLowerCase().includes('recurring donation to hylo')

                    if (isRecurringDonation) {
                      // Calculate donation amount: unit_amount * quantity
                      const itemDonationAmount = (lineItem.price.unit_amount || 0) * (lineItem.quantity || 0)
                      donationAmount += itemDonationAmount

                      // Track recurring interval
                      if (lineItem.price?.recurring) {
                        const interval = lineItem.price.recurring.interval
                        if (interval === 'month') {
                          donationDetails.recurringInterval = 'monthly'
                        } else if (interval === 'year') {
                          donationDetails.recurringInterval = 'annually'
                        } else if (interval === 'week') {
                          donationDetails.recurringInterval = 'weekly'
                        } else if (interval === 'day') {
                          donationDetails.recurringInterval = 'daily'
                        } else {
                          donationDetails.recurringInterval = interval
                        }
                      }

                      if (process.env.NODE_ENV === 'development') {
                        console.log(`Found recurring donation in renewal invoice: ${itemDonationAmount} ${invoice.currency || 'usd'}`)
                      }
                    }
                  }
                }

                // Transfer recurring donation if present
                if (donationAmount > 0) {
                  // For invoices, we need to get the charge ID from the payment intent
                  const paymentIntentId = invoice.payment_intent

                  if (paymentIntentId) {
                    await StripeService.transferDonationToPlatform({
                      connectedAccountId: externalAccountId,
                      paymentIntentId,
                      donationAmount,
                      currency: invoice.currency || 'usd'
                    })

                    if (process.env.NODE_ENV === 'development') {
                      console.log(`Transferred recurring donation of ${donationAmount} ${invoice.currency || 'usd'} to platform from subscription renewal`)
                    }

                    // Send Donation Acknowledgment email for recurring donation
                    try {
                      const firstAccess = accessRecords.at(0)
                      const userId = firstAccess.get('user_id')
                      const user = await User.find(userId)

                      if (user && user.get('email')) {
                        const userLocale = user.getLocale()
                        const donationDate = new Date(invoice.created * 1000)
                        const donationDateFormatted = donationDate.toLocaleDateString(
                          userLocale === 'es' ? 'es-ES' : 'en-US',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }
                        )

                        const donationAmountFormatted = StripeService.formatPrice(donationAmount, invoice.currency || 'usd')

                        // Get group and offering info for context
                        const productId = firstAccess.get('product_id')
                        const offering = productId ? await StripeProduct.where({ id: productId }).fetch() : null
                        let purchaseContext = null
                        if (offering) {
                          purchaseContext = offering.get('name')
                        }

                        // Determine next donation date (based on subscription renewal date)
                        let nextDonationDate = null
                        if (donationDetails.recurringInterval) {
                          // Get subscription to find next billing date
                          try {
                            const subscription = await stripe.subscriptions.retrieve(invoice.subscription, {
                              stripeAccount: externalAccountId
                            })
                            if (subscription.current_period_end) {
                              const nextDate = new Date(subscription.current_period_end * 1000)
                              nextDonationDate = nextDate.toLocaleDateString(
                                userLocale === 'es' ? 'es-ES' : 'en-US',
                                {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                }
                              )
                            }
                          } catch (subError) {
                            // Fallback: calculate from interval
                            const nextDate = new Date(donationDate)
                            if (donationDetails.recurringInterval === 'monthly') {
                              nextDate.setMonth(nextDate.getMonth() + 1)
                            } else if (donationDetails.recurringInterval === 'annually') {
                              nextDate.setFullYear(nextDate.getFullYear() + 1)
                            } else if (donationDetails.recurringInterval === 'weekly') {
                              nextDate.setDate(nextDate.getDate() + 7)
                            } else if (donationDetails.recurringInterval === 'daily') {
                              nextDate.setDate(nextDate.getDate() + 1)
                            }
                            nextDonationDate = nextDate.toLocaleDateString(
                              userLocale === 'es' ? 'es-ES' : 'en-US',
                              {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }
                            )
                          }
                        }

                        // Fiscal sponsor info (use env var or default)
                        const fiscalSponsorName = process.env.FISCAL_SPONSOR_NAME || 'our fiscal sponsor'
                        const localeObj = locales[userLocale] || locales.en
                        const taxReceiptInfo = localeObj.donationTaxReceiptInfo()
                        const impactMessage = localeObj.donationRecurringImpactMessage()

                        const emailData = {
                          user_name: user.get('name'),
                          donation_amount: donationAmountFormatted,
                          donation_type: donationDetails.donationType,
                          donation_date: donationDateFormatted,
                          is_tax_deductible: true,
                          fiscal_sponsor_name: fiscalSponsorName,
                          tax_receipt_info: taxReceiptInfo,
                          is_recurring: true,
                          impact_message: impactMessage
                        }

                        if (nextDonationDate) {
                          emailData.next_donation_date = nextDonationDate
                        }
                        if (donationDetails.recurringInterval) {
                          emailData.recurring_interval = donationDetails.recurringInterval
                        }
                        emailData.manage_donation_url = `${process.env.FRONTEND_URL || 'https://hylo.com'}/settings/subscriptions`

                        if (purchaseContext) {
                          emailData.purchase_context = purchaseContext
                        }

                        if (group) {
                          emailData.group_name = group.get('name')
                        }

                        Queue.classMethod('Email', 'sendDonationAcknowledgment', {
                          email: user.get('email'),
                          data: emailData,
                          version: 'Redesign 2025',
                          locale: userLocale
                        })

                        if (process.env.NODE_ENV === 'development') {
                          console.log(`Queued Donation Acknowledgment email to user ${userId} for recurring donation`)
                        }
                      }
                    } catch (emailError) {
                      // Log error but don't fail the entire webhook - email can be retried
                      console.error('Error queueing donation acknowledgment email for recurring donation:', emailError)
                    }
                  }
                }
              }
            }
          }
        }
      } catch (donationError) {
        // Log error but don't fail the entire webhook - donation transfer can be retried
        console.error('Error processing recurring donation from invoice:', donationError)
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

      // Send Payment Failed email
      try {
        const firstAccess = accessRecords.at(0)
        const userId = firstAccess.get('user_id')
        const productId = firstAccess.get('product_id')
        const groupId = firstAccess.get('granted_by_group_id')

        const user = await User.find(userId)
        const offering = await StripeProduct.where({ id: productId }).fetch()
        const group = await Group.find(groupId)

        if (!user || !offering || !group) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Missing user, offering, or group for payment failed email. Skipping.')
          }
        } else {
          // Get subscription to find current period end (when access will end)
          const groupStripeAccountId = group.get('stripe_account_id')
          let subscription = null
          let accessEndsDate = null

          if (groupStripeAccountId) {
            try {
              const getExternalAccountId = async (accountId) => {
                if (accountId && accountId.startsWith('acct_')) {
                  return accountId
                }
                const StripeAccount = bookshelf.model('StripeAccount')
                const stripeAccount = await StripeAccount.where({ id: accountId }).fetch()
                if (!stripeAccount) {
                  throw new Error('Stripe account record not found')
                }
                return stripeAccount.get('stripe_account_external_id')
              }

              const externalAccountId = await getExternalAccountId(groupStripeAccountId)
              subscription = await stripe.subscriptions.retrieve(
                subscriptionId,
                {},
                externalAccountId ? { stripeAccount: externalAccountId } : {}
              )

              if (subscription.current_period_end) {
                accessEndsDate = new Date(subscription.current_period_end * 1000)
              }
            } catch (subError) {
              console.error('Error fetching subscription for payment failed email:', subError)
              // Continue without subscription details
            }
          }

          const userLocale = user.getLocale()

          // Get failure reason
          let failureReason = 'Payment could not be processed'
          if (invoice.last_payment_error?.message) {
            failureReason = invoice.last_payment_error.message
          } else if (invoice.payment_intent) {
            try {
              const paymentIntent = await stripe.paymentIntents.retrieve(invoice.payment_intent)
              if (paymentIntent.last_payment_error?.message) {
                failureReason = paymentIntent.last_payment_error.message
              }
            } catch (piError) {
              // Continue with default message
              if (process.env.NODE_ENV === 'development') {
                console.log('Could not retrieve payment intent for failure reason:', piError.message)
              }
            }
          }

          // Get retry date if Stripe will retry
          let retryDateFormatted = null
          if (invoice.next_payment_attempt) {
            const retryDate = new Date(invoice.next_payment_attempt * 1000)
            retryDateFormatted = retryDate.toLocaleDateString(
              userLocale === 'es' ? 'es-ES' : 'en-US',
              {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }
            )
          }

          // Format access ends date
          let accessEndsDateFormatted = null
          if (accessEndsDate) {
            accessEndsDateFormatted = accessEndsDate.toLocaleDateString(
              userLocale === 'es' ? 'es-ES' : 'en-US',
              {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }
            )
          }

          const emailData = {
            user_name: user.get('name'),
            offering_name: offering.get('name'),
            group_name: group.get('name'),
            group_url: Frontend.Route.group(group),
            failure_reason: failureReason,
            manage_subscription_url: `${process.env.FRONTEND_URL || 'https://hylo.com'}/settings/subscriptions`,
            update_payment_url: `${process.env.FRONTEND_URL || 'https://hylo.com'}/settings/subscriptions`,
            group_avatar_url: group.get('avatar_url')
          }

          if (retryDateFormatted) {
            emailData.retry_date = retryDateFormatted
          }

          if (accessEndsDateFormatted) {
            emailData.access_ends_date = accessEndsDateFormatted
          }

          Queue.classMethod('Email', 'sendPaymentFailed', {
            email: user.get('email'),
            data: emailData,
            version: 'Redesign 2025',
            locale: userLocale
          })

          if (process.env.NODE_ENV === 'development') {
            console.log(`Queued Payment Failed email to user ${userId}`)
          }
        }
      } catch (emailError) {
        // Log error but don't fail the entire webhook - email can be retried
        console.error('Error queueing payment failed email:', emailError)
      }
    } catch (error) {
      console.error('Error handling invoice.payment_failed:', error)
      throw error
    }
  },

  /**
   * Handle charge.refunded webhook events
   * Revokes access and cancels any associated subscriptions when payment is refunded
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

      // Revoke all associated access records using the model method
      // This will also cancel any associated Stripe subscriptions and trigger
      // database triggers to clean up user_scopes
      await Promise.all(accessRecords.map(async (access) => {
        const reason = charge.refund?.reason || 'Payment refunded via Stripe'

        // Use the revoke method which handles subscription cancellation
        await ContentAccess.revoke(access.id, null, reason)

        // Update metadata with refund details
        const metadata = access.get('metadata') || {}
        metadata.refunded_at = new Date().toISOString()
        metadata.refund_amount = charge.amount_refunded
        metadata.refund_reason = reason
        metadata.refund_charge_id = charge.id

        await access.save({ metadata })
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
