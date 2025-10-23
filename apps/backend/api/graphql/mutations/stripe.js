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

/* global StripeProduct */

module.exports = {

  /**
   * Creates a Stripe Connected Account for a group
   *
   * This mutation allows group administrators to create a connected account
   * that enables them to receive payments directly. The platform takes
   * an application fee on each transaction.
   *
   * Usage:
   *   mutation {
   *     createStripeConnectedAccount(
   *       groupId: "123"
   *       email: "group@example.com"
   *       businessName: "My Group"
   *       country: "US"
   *     ) {
   *       id
   *       accountId
   *       success
   *     }
   *   }
   */
  createStripeConnectedAccount: async (root, { groupId, email, businessName, country }, { session }) => {
    try {
      // Check if user is authenticated
      if (!session || !session.userId) {
        throw new GraphQLError('You must be logged in to create a connected account')
      }

      // Load the group to verify it exists and user has permission
      const group = await Group.find(groupId)
      if (!group) {
        throw new GraphQLError('Group not found')
      }

      // Check if user is a steward/admin of the group
      const membership = await GroupMembership.forPair(session.userId, groupId).fetch()
      if (!membership || !membership.hasResponsibility(GroupMembership.RESP_ADMINISTRATION)) {
        throw new GraphQLError('You must be a group administrator to create a connected account')
      }

      // Check if group already has a Stripe account
      // TODO STRIPE: You may want to store the accountId in your Group model
      // For this demo, we'll just create a new account each time

      // Create the connected account
      const account = await StripeService.createConnectedAccount({
        email: email || group.get('contact_email'),
        country: country || 'US',
        businessName: businessName || group.get('name'),
        groupId
      })

      // TODO STRIPE: Save the account ID to your database
      // await group.save({ stripe_account_id: account.id })

      return {
        id: groupId,
        accountId: account.id,
        success: true,
        message: 'Connected account created successfully'
      }
    } catch (error) {
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
  createStripeAccountLink: async (root, { groupId, accountId, returnUrl, refreshUrl }, { session }) => {
    try {
      // Check if user is authenticated
      if (!session || !session.userId) {
        throw new GraphQLError('You must be logged in to create an account link')
      }

      // Verify user has permission for this group
      const membership = await GroupMembership.forPair(session.userId, groupId).fetch()
      if (!membership || !membership.hasResponsibility(GroupMembership.RESP_ADMINISTRATION)) {
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
  stripeAccountStatus: async (root, { groupId, accountId }, { session }) => {
    try {
      // Check if user is authenticated
      if (!session || !session.userId) {
        throw new GraphQLError('You must be logged in to view account status')
      }

      // Verify user has permission for this group
      const membership = await GroupMembership.forPair(session.userId, groupId).fetch()
      if (!membership) {
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
   *     ) {
   *       productId
   *       priceId
   *       success
   *     }
   *   }
   */
  createStripeProduct: async (root, {
    groupId,
    accountId,
    name,
    description,
    priceInCents,
    currency,
    contentAccess,
    renewalPolicy,
    duration
  }, { session }) => {
    try {
      // Check if user is authenticated
      if (!session || !session.userId) {
        throw new GraphQLError('You must be logged in to create a product')
      }

      // Verify user has permission for this group
      const membership = await GroupMembership.forPair(session.userId, groupId).fetch()
      if (!membership || !membership.hasResponsibility(GroupMembership.RESP_ADMINISTRATION)) {
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
        active: true
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
      console.error('Error in createStripeProduct:', error)
      throw new GraphQLError(`Failed to create product: ${error.message}`)
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
  stripeProducts: async (root, { groupId, accountId }, { session }) => {
    try {
      // Check if user is authenticated
      if (!session || !session.userId) {
        throw new GraphQLError('You must be logged in to view products')
      }

      // Verify user has permission for this group
      const membership = await GroupMembership.forPair(session.userId, groupId).fetch()
      if (!membership || !membership.hasResponsibility(GroupMembership.RESP_ADMINISTRATION)) {
        throw new GraphQLError('You must be a group administrator to view products')
      }

      // Get products from Stripe
      const products = await StripeService.getProducts(accountId)

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
  createStripeCheckoutSession: async (root, {
    groupId,
    accountId,
    priceId,
    quantity,
    successUrl,
    cancelUrl,
    metadata
  }, { session }) => {
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
          userId: session?.userId,
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
      console.error('Error in createStripeCheckoutSession:', error)
      throw new GraphQLError(`Failed to create checkout session: ${error.message}`)
    }
  }
}
