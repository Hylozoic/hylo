/**
 * Content Access GraphQL Queries
 *
 * Provides GraphQL API for querying content access:
 * - Checking if a user has access to specific content
 */

import { GraphQLError } from 'graphql'

/* global ContentAccess */

module.exports = {

  /**
   * Check if user has access to content
   *
   * Query to check if a user has active access to specific content.
   * Can be used by the frontend to gate content display.
   *
   * Usage:
   *   query {
   *     checkContentAccess(
   *       userId: "456"
   *       grantedByGroupId: "123"
   *       groupId: "789"  // optional - for group-specific access
   *       productId: "789"  // optional - or trackId: "101" or roleId: "202"
   *     ) {
   *       hasAccess
   *       accessType
   *       expiresAt
   *     }
   *   }
   */
  checkContentAccess: async (sessionUserId, { userId, grantedByGroupId, groupId, productId, trackId, groupRoleId, commonRoleId }) => {
    try {
      // Check access using the model method
      const access = await ContentAccess.checkAccess({
        userId,
        grantedByGroupId,
        groupId,
        productId,
        trackId,
        groupRoleId,
        commonRoleId
      })

      if (!access) {
        return {
          hasAccess: false,
          accessType: null,
          expiresAt: null,
          grantedAt: null
        }
      }

      return {
        hasAccess: true,
        accessType: access.get('access_type'),
        expiresAt: access.get('expires_at'),
        grantedAt: access.get('created_at')
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }
      console.error('Error in checkContentAccess:', error)
      throw new GraphQLError(`Failed to check access: ${error.message}`)
    }
  }
}
