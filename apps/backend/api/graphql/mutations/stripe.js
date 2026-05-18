/**
 * Stripe Connect GraphQL Mutations
 *
 * Provides GraphQL API for Stripe Connect functionality:
 * - Creating connected accounts for groups
 * - Generating onboarding links
 * - Managing offerings and prices
 * - Creating checkout sessions
 */

import { GraphQLError } from 'graphql'
import StripeService from '../../services/StripeService'
import { extractOfferingPresentationFields, getSlidingScaleFromOffering, parseJsonObject } from '../../../lib/stripeOfferingMetadata'

/* global StripeProduct, Responsibility, Group, GroupMembership, StripeAccount, User, Queue, Frontend */

/**
 * Helper function to convert a database account ID to an external Stripe account ID
 * If the accountId already starts with 'acct_', it's already the external ID
 * Otherwise, look it up from the database
 */
async function getExternalAccountId (accountId) {
  // If it already starts with 'acct_', it's already the external ID
  if (accountId && accountId.startsWith('acct_')) {
    return accountId
  }

  // Otherwise, it's a database ID - look up the external account ID
  const stripeAccount = await StripeAccount.where({ id: accountId }).fetch()
  if (!stripeAccount) {
    throw new GraphQLError('Stripe account record not found')
  }
  return stripeAccount.get('stripe_account_external_id')
}

async function getGroupAdminLocale (group) {
  try {
    const admins = await group.membersWithResponsibilities([Responsibility.Common.RESP_ADMINISTRATION]).fetch()
    if (!admins?.models?.length) {
      return 'en'
    }

    const localeCounts = {}
    for (const adminMembership of admins.models) {
      const admin = adminMembership.relations.user || await User.find(adminMembership.get('user_id'))
      const locale = admin?.getLocale?.()?.toLowerCase()?.split('-')?.[0]
      if (locale) {
        localeCounts[locale] = (localeCounts[locale] || 0) + 1
      }
    }

    const localeEntries = Object.entries(localeCounts)
    if (!localeEntries.length) {
      return 'en'
    }

    localeEntries.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      if (a[0] === 'en') return -1
      if (b[0] === 'en') return 1
      return a[0].localeCompare(b[0])
    })

    return localeEntries[0][0]
  } catch (error) {
    console.error('Error resolving group admin locale, defaulting to English:', error)
  }

  return 'en'
}

module.exports = {

  /**
   * Creates a Stripe Connected Account for a group
   */
  createStripeConnectedAccount: async (userId, { groupId, email, businessName, country }) => {
    try {
      // Check if user is authenticated
      if (!userId) {
        throw new GraphQLError('You must be logged in to create a connected account')
      }

      // Load the group to verify it exists and user has permission
      const group = await Group.find(groupId)
      if (!group) {
        throw new GraphQLError('Group not found')
      }

      // Check if user is a steward/admin of the group
      const hasAdmin = await GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to create a connected account')
      }

      // Check if group already has a Stripe account
      // If stripe_account_id exists, verify the database record still exists
      // (in case DB was cleared but group still has the reference)
      const existingStripeAccountId = group.get('stripe_account_id')
      if (existingStripeAccountId) {
        const existingStripeAccount = await StripeAccount.where({ id: existingStripeAccountId }).fetch()
        if (existingStripeAccount) {
          throw new GraphQLError('This group already has a Stripe account connected')
        }
        // If the database record doesn't exist, we can proceed to reconnect
        // This handles the edge case where DB was cleared but Stripe account still exists
      }

      // Create new Stripe account
      // Note: Stripe will handle the case where the user already has an account
      // by prompting them to connect it during onboarding
      const account = await StripeService.createConnectedAccount({
        email: email || `${group.get('name')}@hylo.com`,
        country: country || 'US',
        businessName: businessName || group.get('name'),
        groupId
      })

      // Find or create a StripeAccount record with this external ID
      let stripeAccountRecord = await StripeAccount.where({
        stripe_account_external_id: account.id
      }).fetch()

      if (!stripeAccountRecord) {
        stripeAccountRecord = await StripeAccount.forge({
          stripe_account_external_id: account.id
        }).save()
      }

      // Save the database ID to the group
      await group.save({ stripe_account_id: stripeAccountRecord.id })

      try {
        const actor = await User.find(userId)
        if (actor) {
          Queue.classMethod('Email', 'sendNewStripeConnectedAccountAdminNotification', {
            groupName: group.get('name'),
            groupSlug: group.get('slug') || '',
            groupUrl: Frontend.Route.group(group),
            groupId: String(group.id),
            stripeAccountExternalId: account.id,
            actorName: actor.get('name'),
            actorEmail: actor.get('email'),
            actorProfileUrl: Frontend.Route.profile(actor)
          })
        }
      } catch (notifyErr) {
        console.error('Failed to queue new Stripe account admin notification:', notifyErr)
      }

      return {
        id: groupId,
        accountId: account.id,
        success: true,
        message: 'Connected account created successfully'
      }
    } catch (error) {
      // If it's already a GraphQLError, rethrow it as-is
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in createStripeConnectedAccount:', error)
      throw new GraphQLError(`Failed to create connected account: ${error.message}`)
    }
  },

  /**
   * Generates an Account Link for onboarding
   *
   * Account Links are temporary URLs that allow the connected account
   * to complete onboarding and access the Stripe Dashboard.
   *
   * Usage:
   *   mutation {
   *     createStripeAccountLink(
   *       groupId: "123"
   *       accountId: "acct_xxx"
   *       returnUrl: "https://yourapp.com/groups/{groupSlug}/settings/paid-content"
   *       refreshUrl: "https://yourapp.com/groups/{groupSlug}/settings/paid-content"
   *     ) {
   *       url
   *       expiresAt
   *     }
   *   }
   */
  createStripeAccountLink: async (userId, { groupId, accountId, returnUrl, refreshUrl }) => {
    try {
      // Check if user is authenticated
      if (!userId) {
        throw new GraphQLError('You must be logged in to create an account link')
      }

      // Verify user has permission for this group
      const hasAdmin = await GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to manage payments')
      }

      // Convert database ID to external account ID if needed
      const externalAccountId = await getExternalAccountId(accountId)

      // Create the account link
      const accountLink = await StripeService.createAccountLink({
        accountId: externalAccountId,
        returnUrl,
        refreshUrl
      })

      return {
        url: accountLink.url,
        expiresAt: accountLink.expires_at,
        success: true
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in createStripeAccountLink:', error)
      throw new GraphQLError(`Failed to create account link: ${error.message}`)
    }
  },

  /**
   * Creates an offering on the connected account
   *
   * Offerings represent subscription tiers, content access, or other
   * offerings that the group wants to sell.
   *
   * Usage:
   *   mutation {
   *     createStripeOffering(
   *       groupId: "123"
   *       accountId: "acct_xxx"
   *       name: "Premium Membership"
   *       description: "Access to all premium content"
   *       priceInCents: 2000
   *       currency: "usd"
   *       accessGrants: {
   *         trackIds: [456, 789]
   *         groupRoleIds: [1, 2]
   *         commonRoleIds: [3, 4]
   *         groupIds: [123]
   *       }
   *       publishStatus: "published"
   *     ) {
   *       productId
   *       priceId
   *       success
   *     }
   *   }
   */
  createStripeOffering: async (userId, {
    groupId,
    accountId,
    name,
    description,
    priceInCents,
    currency,
    accessGrants,
    renewalPolicy,
    duration,
    publishStatus
  }) => {
    try {
      // Check if user is authenticated
      if (!userId) {
        throw new GraphQLError('You must be logged in to create an offering')
      }

      // Verify user has permission for this group
      const hasAdmin = await GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to create offerings')
      }

      // Convert database ID to external account ID if needed
      const externalAccountId = await getExternalAccountId(accountId)

      // Determine billing interval based on duration for recurring products
      // Map duration to Stripe interval and interval_count
      let billingInterval = null
      let billingIntervalCount = 1
      if (duration === 'day') {
        billingInterval = 'day'
        billingIntervalCount = 1 // Daily - for testing subscription expiration
      } else if (duration === 'month') {
        billingInterval = 'month'
        billingIntervalCount = 1
      } else if (duration === 'season') {
        billingInterval = 'month'
        billingIntervalCount = 3 // Quarterly - every 3 months
      } else if (duration === 'annual') {
        billingInterval = 'year'
        billingIntervalCount = 1
      }
      // lifetime and null duration = one-time payment (no interval)

      // Create the product on the connected account
      const product = await StripeService.createProduct({
        accountId: externalAccountId,
        name,
        description,
        priceInCents,
        currency: currency || 'usd',
        billingInterval,
        billingIntervalCount
      })

      // Save offering to database for tracking and association with content
      // Default renewal_policy to 'automatic' for subscription-based products
      const effectiveRenewalPolicy = renewalPolicy || (billingInterval ? 'automatic' : 'manual')

      const { cleanAccessGrants, offeringMetadata } = extractOfferingPresentationFields(accessGrants)

      const stripeProduct = await StripeProduct.create({
        group_id: groupId,
        stripe_product_id: product.id,
        stripe_price_id: product.default_price,
        name: product.name,
        description: product.description,
        price_in_cents: priceInCents,
        currency: currency || 'usd',
        access_grants: cleanAccessGrants,
        metadata: offeringMetadata,
        renewal_policy: effectiveRenewalPolicy,
        duration: duration || null,
        publish_status: publishStatus || 'unpublished'
      })

      return {
        productId: product.id,
        priceId: product.default_price,
        name: product.name,
        databaseId: stripeProduct.id,
        success: true,
        message: 'Offering created successfully'
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in createStripeOffering:', error)
      throw new GraphQLError(`Failed to create offering: ${error.message}`)
    }
  },

  /**
   * Updates an existing Stripe offering
   *
   * Allows group administrators to update offering details including name, description,
   * price, content access, renewal policy, duration, and publish status.
   *
   * Usage:
   *   mutation {
   *     updateStripeOffering(
   *       offeringId: "123"
   *       name: "Updated Premium Membership"
   *       description: "Updated description"
   *       priceInCents: 2500
   *       accessGrants: {
   *         trackIds: [456, 789]
   *         groupRoleIds: [1, 2]
   *         commonRoleIds: [3, 4]
   *         groupIds: [123]
   *       }
   *       publishStatus: "published"
   *     ) {
   *       success
   *       message
   *     }
   *   }
   */
  updateStripeOffering: async (userId, {
    offeringId,
    name,
    description,
    priceInCents,
    currency,
    accessGrants,
    renewalPolicy,
    duration,
    publishStatus
  }) => {
    try {
      // Check if user is authenticated
      if (!userId) {
        throw new GraphQLError('You must be logged in to update an offering')
      }

      // Load the offering and verify permissions
      const product = await StripeProduct.where({ id: offeringId }).fetch()
      if (!product) {
        throw new GraphQLError('Offering not found')
      }

      const hasAdmin = await GroupMembership.hasResponsibility(userId, product.get('group_id'), Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to update offerings')
      }

      // Prepare update attributes (only include provided fields)
      const updateAttrs = {}

      // Fields that need to be synced with Stripe
      const stripeSyncFields = {}
      if (name !== undefined) {
        updateAttrs.name = name
        stripeSyncFields.name = name
      }
      if (description !== undefined) {
        updateAttrs.description = description
        stripeSyncFields.description = description
      }
      if (priceInCents !== undefined) {
        updateAttrs.price_in_cents = priceInCents
        stripeSyncFields.priceInCents = priceInCents
      }
      if (currency !== undefined) {
        updateAttrs.currency = currency
        stripeSyncFields.currency = currency
      }

      // Fields that are platform-only (don't sync with Stripe)
      if (accessGrants !== undefined) {
        const { cleanAccessGrants, offeringMetadata } = extractOfferingPresentationFields(accessGrants)
        const nextMeta = { ...parseJsonObject(product.get('metadata')) }
        if (offeringMetadata.buyButtonText != null) {
          nextMeta.buyButtonText = offeringMetadata.buyButtonText
        } else {
          delete nextMeta.buyButtonText
        }
        if (offeringMetadata.slidingScale != null) {
          nextMeta.slidingScale = offeringMetadata.slidingScale
        } else {
          delete nextMeta.slidingScale
        }
        updateAttrs.access_grants = cleanAccessGrants
        updateAttrs.metadata = nextMeta
      }
      if (renewalPolicy !== undefined) updateAttrs.renewal_policy = renewalPolicy
      if (duration !== undefined) updateAttrs.duration = duration
      if (publishStatus !== undefined) {
        // Validate publish status
        const validStatuses = ['unpublished', 'unlisted', 'published', 'archived']
        if (!validStatuses.includes(publishStatus)) {
          throw new GraphQLError('Invalid publish status. Must be unpublished, unlisted, published, or archived')
        }
        updateAttrs.publish_status = publishStatus
      }

      // Sync with Stripe first if there are fields that need syncing
      if (Object.keys(stripeSyncFields).length > 0) {
        const group = await Group.find(product.get('group_id'))
        if (!group || !group.get('stripe_account_id')) {
          throw new GraphQLError('Group does not have a connected Stripe account')
        }

        // Convert database account ID to external Stripe account ID
        const externalAccountId = await getExternalAccountId(group.get('stripe_account_id'))

        // If price is being updated but not currency, preserve the existing currency
        if (priceInCents !== undefined && currency === undefined) {
          stripeSyncFields.currency = product.get('currency')
        }

        // Update product in Stripe first
        const updatedStripeProduct = await StripeService.updateProduct({
          accountId: externalAccountId,
          productId: product.get('stripe_product_id'),
          ...stripeSyncFields
        })

        // Update our database with the actual values from Stripe
        // Only update fields that were actually provided in the request
        if (name !== undefined) updateAttrs.name = updatedStripeProduct.name
        if (description !== undefined) updateAttrs.description = updatedStripeProduct.description
        if (priceInCents !== undefined) updateAttrs.price_in_cents = updatedStripeProduct.default_price.unit_amount
        if (currency !== undefined || (priceInCents !== undefined && currency === undefined)) {
          // Update currency if explicitly provided, or if price changed and we preserved it
          updateAttrs.currency = updatedStripeProduct.default_price.currency
        }
        // Always update the stripe_price_id if price changed
        if (priceInCents !== undefined || currency !== undefined) {
          updateAttrs.stripe_price_id = updatedStripeProduct.default_price.id
        }
      }

      // Update the offering in our database
      await product.save(updateAttrs)

      return {
        success: true,
        message: 'Offering updated successfully'
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in updateStripeOffering:', error)
      throw new GraphQLError(`Failed to update offering: ${error.message}`)
    }
  },

  /**
   * Creates a checkout session for purchasing a product
   *
   * This mutation creates a Stripe Checkout session and returns a URL
   * that the customer should be redirected to for payment.
   *
   * Usage:
   *   mutation {
   *     createStripeCheckoutSession(
   *       groupId: "123"
   *       accountId: "acct_xxx"
   *       priceId: "price_xxx"
   *       quantity: 1
   *       successUrl: "https://yourapp.com/success"
   *       cancelUrl: "https://yourapp.com/cancel"
   *     ) {
   *       sessionId
   *       url
   *     }
   *   }
   */
  createStripeCheckoutSession: async (userId, {
    groupId,
    offeringId,
    quantity,
    adjustableQuantity,
    successUrl,
    cancelUrl,
    metadata
  }) => {
    try {
      // Require authenticated user to prevent orphaned transactions; IF YOU WANT TO CHANGE THIS...
      // please don't remove this condiitonal; instead have a new param that overrides it. This needs to be the default. Allowing transactions to non-users is open to massive abuse
      if (!userId) {
        throw new GraphQLError('You must be logged in to purchase an offering')
      }

      // Look up the offering from the database
      const offering = await StripeProduct.where({ id: offeringId }).fetch()
      if (!offering) {
        throw new GraphQLError('Offering not found')
      }

      // Verify the offering belongs to the specified group
      const offeringGroupId = offering.get('group_id')
      if (parseInt(offeringGroupId) !== parseInt(groupId)) {
        throw new GraphQLError('Offering does not belong to the specified group')
      }

      // Get the group to access its Stripe account ID
      const group = await Group.where({ id: groupId }).fetch()
      if (!group) {
        throw new GraphQLError('Group not found')
      }

      const stripeAccountId = group.get('stripe_account_id')
      if (!stripeAccountId) {
        throw new GraphQLError('Group does not have a Stripe account configured')
      }
      if (group.get('stripe_sales_paused')) {
        throw new GraphQLError('This group cannot accept payments right now. Please contact the group stewards.')
      }

      // Get the Stripe price ID from the offering
      const stripePriceId = offering.get('stripe_price_id')
      if (!stripePriceId) {
        throw new GraphQLError('Offering does not have a Stripe price ID')
      }

      // Sliding scale: stripe_products.metadata.slidingScale (legacy: access_grants)
      const slidingScale = getSlidingScaleFromOffering(offering)
      const parseOptionalInt = (value) => {
        if (value == null || value === '') return null
        const parsed = parseInt(value, 10)
        return Number.isNaN(parsed) ? null : parsed
      }
      const inferredAdjustableQuantity = slidingScale?.enabled
        ? {
            enabled: true,
            minimum: parseOptionalInt(slidingScale.minimum),
            maximum: parseOptionalInt(slidingScale.maximum)
          }
        : null

      const effectiveAdjustableQuantity = adjustableQuantity || inferredAdjustableQuantity

      // Convert database ID to external account ID if needed
      const externalAccountId = await getExternalAccountId(stripeAccountId)

      // If sliding scale is enabled, we should charge using a shared unit price
      // for the offering currency (1 unit * chosen quantity).
      const offeringCurrency = offering.get('currency') || 'usd'
      const effectiveLocale = await getGroupAdminLocale(group)
      const isSlidingScaleEnabled = effectiveAdjustableQuantity?.enabled

      // Safety defaults:
      // - minimum defaults to 1 (avoid $0 purchases granting access)
      // - maximum defaults to 999999 (Stripe adjustable_quantity supported upper bound)
      const effectiveMinimum = isSlidingScaleEnabled
        ? (effectiveAdjustableQuantity.minimum ?? 1)
        : null
      const effectiveMaximum = isSlidingScaleEnabled
        ? (effectiveAdjustableQuantity.maximum ?? 999999)
        : null

      const sanitizedAdjustableQuantity = isSlidingScaleEnabled
        ? {
            enabled: true,
            minimum: effectiveMinimum,
            maximum: effectiveMaximum
          }
        : null

      // Determine checkout mode based on renewal policy
      // If automatic renewal, use subscription mode; otherwise payment mode
      const renewalPolicy = offering.get('renewal_policy')
      const checkoutMode = renewalPolicy === 'automatic' ? 'subscription' : 'payment'

      let effectiveStripePriceId = stripePriceId
      if (sanitizedAdjustableQuantity?.enabled) {
        // In subscription mode, Stripe requires a recurring price.
        // Ensure our shared sliding-scale unit price matches the offering's interval.
        const duration = offering.get('duration')
        let billingInterval = null
        let billingIntervalCount = 1

        if (checkoutMode === 'subscription') {
          if (duration === 'day') {
            billingInterval = 'day'
            billingIntervalCount = 1
          } else if (duration === 'month') {
            billingInterval = 'month'
            billingIntervalCount = 1
          } else if (duration === 'season') {
            billingInterval = 'month'
            billingIntervalCount = 3
          } else if (duration === 'annual') {
            billingInterval = 'year'
            billingIntervalCount = 1
          } else {
            throw new GraphQLError('Sliding scale subscriptions require a recurring duration (month, season, annual, or day)')
          }
        }

        effectiveStripePriceId = await StripeService.ensureSlidingScaleUnitPriceExists(
          externalAccountId,
          offeringCurrency,
          billingInterval,
          billingIntervalCount,
          effectiveLocale
        )
      }

      // Fetch the actual price from Stripe to calculate the application fee accurately
      const priceObject = await StripeService.getPrice(externalAccountId, effectiveStripePriceId)

      // Calculate the total amount (price * initialQuantity)
      // If adjustableQuantity is provided, we use it to pick a safe initial quantity
      // for fee calculation until the customer picks their final quantity in Stripe Checkout.
      const initialQuantity = sanitizedAdjustableQuantity?.minimum ?? quantity ?? 1
      const totalAmount = priceObject.unit_amount * initialQuantity

      // Calculate application fee (7% of total)
      // TODO STRIPE: Consider making this configurable per group or product
      const applicationFeePercentage = 0.07 // 7%
      const applicationFeeAmount = Math.round(totalAmount * applicationFeePercentage)

      // Create the checkout session
      const checkoutSession = await StripeService.createCheckoutSession({
        accountId: externalAccountId,
        priceId: effectiveStripePriceId,
        quantity: initialQuantity,
        applicationFeeAmount,
        successUrl: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&offering_id=${offeringId}`,
        cancelUrl,
        mode: checkoutMode,
        adjustableQuantity: sanitizedAdjustableQuantity,
        locale: effectiveLocale,
        metadata: {
          groupId,
          offeringId,
          userId,
          priceAmount: priceObject.unit_amount,
          currency: priceObject.currency,
          ...metadata
        }
      })

      return {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        success: true
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in createStripeCheckoutSession:', error)
      throw new GraphQLError(`Failed to create checkout session: ${error.message}`)
    }
  },

  /**
   * Checks the Stripe account status and updates the database
   *
   * This mutation fetches the current status from Stripe and updates
   * the group's stripe status fields in the database.
   *
   * Usage:
   *   mutation {
   *     checkStripeStatus(groupId: "123") {
   *       success
   *       message
   *       chargesEnabled
   *       payoutsEnabled
   *       detailsSubmitted
   *     }
   *   }
   */
  checkStripeStatus: async (userId, { groupId }) => {
    try {
      // Check if user is authenticated
      if (!userId) {
        throw new GraphQLError('You must be logged in to check Stripe status')
      }

      // Load the group
      const group = await Group.find(groupId)
      if (!group) {
        throw new GraphQLError('Group not found')
      }

      // Verify user has permission for this group
      const hasAdmin = await GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to check Stripe status')
      }

      // Get the Stripe account ID from the group
      const stripeAccountId = group.get('stripe_account_id')
      if (!stripeAccountId) {
        throw new GraphQLError('Group does not have a connected Stripe account')
      }

      // Get the StripeAccount record to find the external account ID
      const stripeAccount = await StripeAccount.where({ id: stripeAccountId }).fetch()
      if (!stripeAccount) {
        throw new GraphQLError('Stripe account record not found')
      }

      const externalAccountId = stripeAccount.get('stripe_account_external_id')

      // Get account status from Stripe
      const status = await StripeService.getAccountStatus(externalAccountId)

      // Update the group with the latest status from Stripe
      await group.save({
        stripe_charges_enabled: status.charges_enabled,
        stripe_payouts_enabled: status.payouts_enabled,
        stripe_details_submitted: status.details_submitted
      }, { patch: true })

      return {
        success: true,
        message: 'Stripe status updated successfully',
        chargesEnabled: status.charges_enabled,
        payoutsEnabled: status.payouts_enabled,
        detailsSubmitted: status.details_submitted
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in checkStripeStatus:', error)
      throw new GraphQLError(`Failed to check Stripe status: ${error.message}`)
    }
  }
}
