/**
 * Utility functions for working with accessGrants data from Stripe offerings
 *
 * accessGrants can be either a JSON string or an object with the structure:
 * {
 *   trackIds: [1, 2, 3],
 *   groupIds: [4, 5, 6],
 *   commonRoleIds: [7, 8],  // Common roles (from common_roles table)
 *   groupRoleIds: [9, 10],   // Group roles (from groups_roles table)
 *   buyButtonText: "Join now"  // Optional; UI/checkout only (also stored on stripe_products.metadata)
 *   slidingScale: { enabled, minimum?, maximum? }  // Optional; checkout quantity range (also in metadata)
 * }
 * Access logic uses trackIds, groupIds, commonRoleIds, groupRoleIds; presentation fields are ignored there.
 * The client may still send buyButtonText / slidingScale inside this object; the API persists them in metadata.
 */

/**
 * Parses accessGrants from either a JSON string or an object
 * @param {string|object|null|undefined} accessGrants - The accessGrants value to parse
 * @returns {object} Parsed accessGrants object, or empty object if invalid
 */
export function parseAccessGrants (accessGrants) {
  if (!accessGrants) {
    return {}
  }

  // If it's already an object, use it directly
  if (typeof accessGrants === 'object' && !Array.isArray(accessGrants)) {
    return accessGrants
  }

  // If it's a string, try to parse it
  if (typeof accessGrants === 'string') {
    try {
      return JSON.parse(accessGrants)
    } catch (e) {
      console.warn('Failed to parse accessGrants as JSON:', e)
      return {}
    }
  }

  return {}
}

/**
 * Checks if an offering grants access to a specific track
 * @param {object} offering - The offering object with tracks relation or accessGrants
 * @param {string|number} trackId - The track ID to check
 * @returns {boolean} True if the offering grants access to the track
 */
export function offeringGrantsTrackAccess (offering, trackId) {
  if (!offering || !trackId) {
    return false
  }

  // Prefer tracks relation if available
  if (offering.tracks && Array.isArray(offering.tracks)) {
    return offering.tracks.some(track => parseInt(track.id) === parseInt(trackId))
  }

  // Fallback to parsing accessGrants
  const accessGrants = parseAccessGrants(offering.accessGrants)

  if (accessGrants.trackIds && Array.isArray(accessGrants.trackIds)) {
    return accessGrants.trackIds.some(id => parseInt(id) === parseInt(trackId))
  }

  return false
}

/**
 * Checks if an offering grants access to a specific group
 * @param {object} offering - The offering object with accessGrants
 * @param {string|number} groupId - The group ID to check
 * @returns {boolean} True if the offering grants access to the group
 */
export function offeringGrantsGroupAccess (offering, groupId) {
  if (!offering || !groupId) {
    return false
  }

  const accessGrants = parseAccessGrants(offering.accessGrants)

  if (accessGrants.groupIds && Array.isArray(accessGrants.groupIds)) {
    return accessGrants.groupIds.some(id => parseInt(id) === parseInt(groupId))
  }

  return false
}

/**
 * Checks if an offering has any track access grants
 * @param {object} offering - The offering object with tracks relation or accessGrants
 * @returns {boolean} True if the offering grants access to any tracks
 */
export function offeringHasTrackAccess (offering) {
  if (!offering) {
    return false
  }

  // Prefer tracks relation if available
  if (offering.tracks && Array.isArray(offering.tracks)) {
    return offering.tracks.length > 0
  }

  // Fallback to parsing accessGrants
  const accessGrants = parseAccessGrants(offering.accessGrants)
  return accessGrants.trackIds && Array.isArray(accessGrants.trackIds) && accessGrants.trackIds.length > 0
}

/**
 * Checks if an offering has any group access grants
 * @param {object} offering - The offering object with accessGrants
 * @returns {boolean} True if the offering grants access to any groups
 */
export function offeringHasGroupAccess (offering) {
  if (!offering) {
    return false
  }

  const accessGrants = parseAccessGrants(offering.accessGrants)
  return accessGrants.groupIds && Array.isArray(accessGrants.groupIds) && accessGrants.groupIds.length > 0
}

/**
 * Checks if access grants only grant track access (no groups or roles).
 * Track access is always one-time; offerings with tracks-only should not be recurring.
 *
 * @param {string|object|null|undefined} accessGrants
 * @returns {boolean}
 */
export function accessGrantsGrantTracksOnly (accessGrants) {
  const ag = parseAccessGrants(accessGrants)
  const hasTracks = Array.isArray(ag.trackIds) && ag.trackIds.length > 0
  const hasGroups = Array.isArray(ag.groupIds) && ag.groupIds.length > 0
  const hasCommonRoles = Array.isArray(ag.commonRoleIds) && ag.commonRoleIds.length > 0
  const hasGroupRoles = Array.isArray(ag.groupRoleIds) && ag.groupRoleIds.length > 0
  return hasTracks && !hasGroups && !hasCommonRoles && !hasGroupRoles
}

/**
 * Checks if line items selection only includes tracks (no groups or roles).
 *
 * @param {{ tracks?: Array, groups?: Array, roles?: Array }} lineItems
 * @returns {boolean}
 */
export function lineItemsGrantTracksOnly (lineItems) {
  if (!lineItems) return false
  const hasTracks = Array.isArray(lineItems.tracks) && lineItems.tracks.length > 0
  const hasGroups = Array.isArray(lineItems.groups) && lineItems.groups.length > 0
  const hasRoles = Array.isArray(lineItems.roles) && lineItems.roles.length > 0
  return hasTracks && !hasGroups && !hasRoles
}

/**
 * Resolves offering duration for create/update; tracks-only offerings are always one-time.
 *
 * @param {{ tracks?: Array, groups?: Array, roles?: Array }} lineItems
 * @param {string|null|undefined} duration
 * @returns {string|null}
 */
export function offeringDurationForLineItems (lineItems, duration) {
  if (lineItemsGrantTracksOnly(lineItems)) return null
  return duration || null
}

/**
 * Checks if an offering has any role access grants
 * @param {object} offering - The offering object with groupRoles/commonRoles relations or accessGrants
 * @returns {boolean} True if the offering grants access to any roles
 */
export function offeringHasRoleAccess (offering) {
  if (!offering) {
    return false
  }

  // Prefer role relations if available
  const hasGroupRolesRelation = offering.groupRoles && Array.isArray(offering.groupRoles) && offering.groupRoles.length > 0
  const hasCommonRolesRelation = offering.commonRoles && Array.isArray(offering.commonRoles) && offering.commonRoles.length > 0
  if (hasGroupRolesRelation || hasCommonRolesRelation) {
    return true
  }

  // Fallback to parsing accessGrants
  const accessGrants = parseAccessGrants(offering.accessGrants)
  const hasCommonRoles = accessGrants.commonRoleIds && Array.isArray(accessGrants.commonRoleIds) && accessGrants.commonRoleIds.length > 0
  const hasGroupRoles = accessGrants.groupRoleIds && Array.isArray(accessGrants.groupRoleIds) && accessGrants.groupRoleIds.length > 0
  return hasCommonRoles || hasGroupRoles
}
