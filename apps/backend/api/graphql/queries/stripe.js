/**
 * Stripe GraphQL Queries
 *
 * Provides GraphQL API for querying Stripe-related data:
 * - Account status
 * - Offerings/products
 * - Subscription stats
 */

import { GraphQLError } from 'graphql'
import StripeService from '../../services/StripeService'
import OfferingStatsService from '../../services/OfferingStatsService'

/* global StripeProduct, Responsibility, GroupMembership, StripeAccount */

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

module.exports = {

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

      // Convert database ID to external account ID if needed
      const externalAccountId = await getExternalAccountId(accountId)

      // Get account status from Stripe using the external account ID
      const status = await StripeService.getAccountStatus(externalAccountId)

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
   * Lists all offerings for a connected account
   *
   * Fetches offerings from the database (not from Stripe API) to ensure
   * we show all offerings including those that may not be synced to Stripe yet.
   *
   * Usage:
   *   query {
   *     stripeOfferings(
   *       groupId: "123"
   *       accountId: "acct_xxx"
   *     ) {
   *       offerings {
   *         id
   *         name
   *         description
   *         priceInCents
   *         currency
   *         stripeProductId
   *         stripePriceId
   *       }
   *     }
   *   }
   */
  stripeOfferings: async (userId, { groupId, accountId }) => {
    try {
      // Check if user is authenticated
      if (!userId) {
        throw new GraphQLError('You must be logged in to view offerings')
      }

      // Verify user has permission for this group
      const hasAdmin = await GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to view offerings')
      }

      // Fetch offerings from database for this group
      // Return Bookshelf model instances so GraphQL can use the getters defined in makeModels.js
      const products = await StripeProduct.where({ group_id: groupId }).fetchAll()

      return {
        offerings: products.models,
        success: true
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in stripeOfferings:', error)
      throw new GraphQLError(`Failed to retrieve offerings: ${error.message}`)
    }
  },

  /**
   * Lists published offerings for a group (public, no auth required)
   *
   * Fetches only published offerings from the database that grant access to the group.
   * This is a public query that doesn't require authentication.
   *
   * Usage:
   *   query {
   *     publicStripeOfferings(groupId: "123") {
   *       offerings {
   *         id
   *         name
   *         description
   *         priceInCents
   *         currency
   *         stripeProductId
   *         stripePriceId
   *         accessGrants
   *         publishStatus
   *         duration
   *       }
   *       success
   *     }
   *   }
   */
  publicStripeOfferings: async (userId, { groupId }) => {
    try {
      // Fetch only published offerings from database for this group
      const products = await StripeProduct.where({
        group_id: groupId,
        publish_status: 'published'
      }).fetchAll()

      // Filter to only offerings that grant access to this group
      const groupAccessOfferings = products.models.filter(product => {
        const accessGrants = product.get('access_grants')
        if (!accessGrants) {
          return false
        }

        // Parse accessGrants (might be string or object)
        let grants = {}
        if (typeof accessGrants === 'string') {
          try {
            grants = JSON.parse(accessGrants)
          } catch (e) {
            console.warn('Failed to parse accessGrants as JSON for product:', product.get('id'), e)
            return false
          }
        } else {
          grants = accessGrants
        }

        // Check if it includes the current group's ID
        if (grants.groupIds && Array.isArray(grants.groupIds)) {
          return grants.groupIds.some(gId => parseInt(gId) === parseInt(groupId))
        }

        return false
      })

      return {
        offerings: groupAccessOfferings,
        success: true
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in publicStripeOfferings:', error)
      throw new GraphQLError(`Failed to retrieve offerings: ${error.message}`)
    }
  },

  /**
   * Get a single offering by ID (public, no auth required)
   * Includes unlisted offerings so they can be accessed via direct link
   *
   * @param {String|Number} userId - Not used (public query)
   * @param {Object} args
   * @param {String|Number} args.offeringId - The offering ID to fetch
   * @returns {Promise<StripeProduct>} The offering
   *
   * Example query:
   *   {
   *     publicStripeOffering(offeringId: "123") {
   *       id
   *       name
   *       description
   *       priceInCents
   *       currency
   *       tracks {
   *         id
   *         name
   *       }
   *       roles {
   *         id
   *         name
   *       }
   *     }
   *   }
   */
  publicStripeOffering: async (userId, { offeringId }) => {
    try {
      // Fetch offering by ID from database (no publish_status filter - includes unlisted)
      const offering = await StripeProduct.where({ id: offeringId }).fetch()

      if (!offering) {
        throw new GraphQLError('Offering not found')
      }

      return offering
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in publicStripeOffering:', error)
      throw new GraphQLError(`Failed to retrieve offering: ${error.message}`)
    }
  },

  /**
   * Get subscription stats for an offering
   *
   * Returns active subscriber count, lapsed subscriber count, and monthly revenue.
   * Requires group admin permissions.
   *
   * Usage:
   *   query {
   *     offeringSubscriptionStats(offeringId: "123", groupId: "456") {
   *       activeCount
   *       lapsedCount
   *       monthlyRevenueCents
   *       currency
   *       success
   *     }
   *   }
   */
  offeringSubscriptionStats: async (userId, { offeringId, groupId }) => {
    try {
      // Check if user is authenticated
      if (!userId) {
        throw new GraphQLError('You must be logged in to view offering stats')
      }

      // Verify user has admin permission for this group
      const hasAdmin = await GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
      if (!hasAdmin) {
        throw new GraphQLError('You must be a group administrator to view offering stats')
      }

      // Verify the offering belongs to this group
      const offering = await StripeProduct.where({ id: offeringId, group_id: groupId }).fetch()
      if (!offering) {
        throw new GraphQLError('Offering not found or does not belong to this group')
      }

      // Get stats from OfferingStatsService
      const stats = await OfferingStatsService.getSubscriptionStats(offeringId)

      // Note: monthlyRevenueCents will be implemented in backend-5 (Stripe API integration)
      // For now, return null for revenue
      return {
        activeCount: stats.activeCount,
        lapsedCount: stats.lapsedCount,
        monthlyRevenueCents: null, // TODO: Implement in backend-5 via Stripe API
        currency: offering.get('currency') || 'usd',
        success: true,
        message: null
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in offeringSubscriptionStats:', error)
      throw new GraphQLError(`Failed to retrieve offering stats: ${error.message}`)
    }
  }
}
