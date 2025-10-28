/**
 * Stripe Connect GraphQL Mutations
 *
 * Provides GraphQL API for Stripe Connect functionality:
 * - Creating connected accounts for groups
 * - Generating onboarding links
 * - Managing products and prices
 * - Creating checkout sessions
 */

import { GraphQLError } from 'graphql'

/* global StripeProduct, Responsibility, Group, GroupMembership, StripeAccount */

module.exports = {

  /**
   * Creates a Stripe Connected Account for a group
   */
  createStripeConnectedAccount: async (userId, { groupId, email, businessName, country, existingAccountId }) => {
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
      if (group.get('stripe_account_id')) {
        throw new GraphQLError('This group already has a Stripe account connected')
      }

      let account

      if (existingAccountId) {
        // Validate the Stripe account ID format
        if (!existingAccountId.startsWith('acct_')) {
          throw new GraphQLError('Invalid Stripe account ID provided')
        }

        // Connect existing Stripe account
        account = await StripeService.connectExistingAccount({
          accountId: existingAccountId,
          groupId
        })
      } else {
        // Create new Stripe account
        account = await StripeService.createConnectedAccount({
          email: email || `${group.get('name')}@hylo.com`,
          country: country || 'US',
          businessName: businessName || group.get('name'),
          groupId
        })
      }

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

      // Create the account link
      const accountLink = await StripeService.createAccountLink({
        accountId,
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
   * Retrieves the status of a connected account
   *
   * This query fetches the current onboarding status and capabilities
   * of a connected account directly from Stripe.
   *
   * Usage:
   *   query {
   *     stripeAccountStatus(
   *       groupId: "123"
   *       accountId: "acct_xxx"
   *     ) {
   *       chargesEnabled
   *       payoutsEnabled
   *       detailsSubmitted
   *     }
   *   }
   */
  stripeAccountStatus: async (userId, { groupId, accountId }) => {
    try {
      // Check if user is authenticated
      if (!userId) {
        throw new GraphQLError('You must be logged in to view account status')
      }

      // Verify user has permission for this group
      const hasMembership = await GroupMembership.hasActiveMembership(userId, groupId)
      if (!hasMembership) {
        throw new GraphQLError('You must be a member of this group to view payment status')
      }

      // Get account status from Stripe
      const status = await StripeService.getAccountStatus(accountId)

      return {
        accountId: status.id,
        chargesEnabled: status.charges_enabled,
        payoutsEnabled: status.payouts_enabled,
        detailsSubmitted: status.details_submitted,
        email: status.email,
        requirements: status.requirements
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in stripeAccountStatus:', error)
      throw new GraphQLError(`Failed to retrieve account status: ${error.message}`)
    }
  },

  /**
   * Creates a product on the connected account
   *
   * Products represent subscription tiers, content access, or other
   * offerings that the group wants to sell.
   *
   * Usage:
   *   mutation {
   *     createStripeProduct(
   *       groupId: "123"
   *       accountId: "acct_xxx"
   *       name: "Premium Membership"
   *       description: "Access to all premium content"
   *       priceInCents: 2000
   *       currency: "usd"
   *       contentAccess: {
   *         "123": {
   *           trackIds: [456, 789]
   *           roleIds: [1, 2]
   *         }
   *       }
   *       publishStatus: "published"
   *     ) {
   *       productId
   *       priceId
   *       success
   *     }
   *   }
   */
  createStripeProduct: async (userId, {
    groupId,
    accountId,
    name,
    description,
    priceInCents,
    currency,
    contentAccess,
    renewalPolicy,
    duration,
    publishStatus
  }) => {
    try {
      // Check if user is authenticated
      if (!userId) {
        throw new GraphQLError('You must be logged in to create a product')
      }

      // Verify user has permission for this group
      const hasAdmin = await GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to create products')
      }

      // Create the product on the connected account
      const product = await StripeService.createProduct({
        accountId,
        name,
        description,
        priceInCents,
        currency: currency || 'usd'
      })

      // Save product to database for tracking and association with content
      const stripeProduct = await StripeProduct.create({
        group_id: groupId,
        stripe_product_id: product.id,
        stripe_price_id: product.default_price,
        name: product.name,
        description: product.description,
        price_in_cents: priceInCents,
        currency: currency || 'usd',
        content_access: contentAccess || {},
        renewal_policy: renewalPolicy || 'manual',
        duration: duration || null,
        publish_status: publishStatus || 'unpublished'
      })

      return {
        productId: product.id,
        priceId: product.default_price,
        name: product.name,
        databaseId: stripeProduct.id,
        success: true,
        message: 'Product created successfully'
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in createStripeProduct:', error)
      throw new GraphQLError(`Failed to create product: ${error.message}`)
    }
  },

  /**
   * Updates an existing Stripe product
   *
   * Allows group administrators to update product details including name, description,
   * price, content access, renewal policy, duration, and publish status.
   *
   * Usage:
   *   mutation {
   *     updateStripeProduct(
   *       productId: "123"
   *       name: "Updated Premium Membership"
   *       description: "Updated description"
   *       priceInCents: 2500
   *       contentAccess: {
   *         "123": {
   *           trackIds: [456, 789]
   *           roleIds: [1, 2]
   *         }
   *       }
   *       publishStatus: "published"
   *     ) {
   *       success
   *       message
   *     }
   *   }
   */
  updateStripeProduct: async (userId, {
    productId,
    name,
    description,
    priceInCents,
    currency,
    contentAccess,
    renewalPolicy,
    duration,
    publishStatus
  }) => {
    try {
      // Check if user is authenticated
      if (!userId) {
        throw new GraphQLError('You must be logged in to update a product')
      }

      // Load the product and verify permissions
      const product = await StripeProduct.where({ id: productId }).fetch()
      if (!product) {
        throw new GraphQLError('Product not found')
      }

      const hasAdmin = await GroupMembership.hasResponsibility(userId, product.get('group_id'), Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to update products')
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
      if (contentAccess !== undefined) updateAttrs.content_access = contentAccess
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

        // If price is being updated but not currency, preserve the existing currency
        if (priceInCents !== undefined && currency === undefined) {
          stripeSyncFields.currency = product.get('currency')
        }

        // Update product in Stripe first
        const updatedStripeProduct = await StripeService.updateProduct({
          accountId: group.get('stripe_account_id'),
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

      // Update the product in our database
      await product.save(updateAttrs)

      return {
        success: true,
        message: 'Product updated successfully'
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in updateStripeProduct:', error)
      throw new GraphQLError(`Failed to update product: ${error.message}`)
    }
  },

  /**
   * Lists all products for a connected account
   *
   * Usage:
   *   query {
   *     stripeProducts(
   *       groupId: "123"
   *       accountId: "acct_xxx"
   *     ) {
   *       products {
   *         id
   *         name
   *         description
   *         defaultPrice {
   *           unitAmount
   *           currency
   *         }
   *       }
   *     }
   *   }
   */
  stripeProducts: async (userId, { groupId, accountId }) => {
    try {
      // Check if user is authenticated
      if (!userId) {
        throw new GraphQLError('You must be logged in to view products')
      }

      // Verify user has permission for this group
      const hasAdmin = await GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to view products')
      }

      // Get products from Stripe
      const productsResponse = await StripeService.getProducts(accountId)

      // Extract products array from Stripe response (which has a 'data' property)
      const products = productsResponse.data || productsResponse

      // Format products for GraphQL response
      const formattedProducts = products.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        defaultPriceId: product.default_price,
        images: product.images,
        active: product.active
      }))

      return {
        products: formattedProducts,
        success: true
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in stripeProducts:', error)
      throw new GraphQLError(`Failed to retrieve products: ${error.message}`)
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
    accountId,
    priceId,
    quantity,
    successUrl,
    cancelUrl,
    metadata
  }) => {
    try {
      // Authentication is optional for checkout - you may want to allow guests
      // For this demo, we'll allow unauthenticated purchases

      // Fetch the actual price from Stripe to calculate the application fee accurately
      const priceObject = await StripeService.getPrice(accountId, priceId)

      // Calculate the total amount (price * quantity)
      const totalAmount = priceObject.unit_amount * (quantity || 1)

      // Calculate application fee (10% of total as example)
      // TODO STRIPE: Adjust this percentage or calculation based on your business model
      // You can make this configurable per group or product
      const applicationFeePercentage = 0.10 // 10%
      const applicationFeeAmount = Math.round(totalAmount * applicationFeePercentage)

      // Create the checkout session
      const checkoutSession = await StripeService.createCheckoutSession({
        accountId,
        priceId,
        quantity: quantity || 1,
        applicationFeeAmount,
        successUrl: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&account_id=${accountId}`,
        cancelUrl,
        metadata: {
          groupId,
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
  }
}
